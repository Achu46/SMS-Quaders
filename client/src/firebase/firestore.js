import { api } from "../services/api";
import { socket } from "./config";

// --- Multi-Tenant Universal Collections CRUD ---

export const getSubCollection = async (schoolId, collectionName) => {
  try {
    if (!schoolId) return [];
    return await api.get(`/schools/${schoolId}/collections/${collectionName}`);
  } catch (error) {
    console.error(`Error fetching collection ${collectionName}:`, error);
    return [];
  }
};

export const notifyCollectionChange = (collectionName, detail = {}) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`quaders_collection_${collectionName}`, { detail }));
    window.dispatchEvent(new CustomEvent('quaders_any_collection_change', { detail: { collection: collectionName, ...detail } }));
  }
};

export const addSubDocument = async (schoolId, collectionName, data) => {
  try {
    if (!schoolId) return null;
    const res = await api.post(`/schools/${schoolId}/collections/${collectionName}`, data);
    notifyCollectionChange(collectionName, { action: 'create', doc: res, schoolId });
    return res;
  } catch (error) {
    console.error(`Error adding to collection ${collectionName}:`, error);
    throw error;
  }
};

export const updateSubDocument = async (schoolId, collectionName, id, data) => {
  try {
    if (!schoolId) return null;
    const res = await api.put(`/schools/${schoolId}/collections/${collectionName}/${id}`, data);
    notifyCollectionChange(collectionName, { action: 'update', doc: res, id, schoolId });
    return res;
  } catch (error) {
    console.error(`Error updating document ${id} in ${collectionName}:`, error);
    throw error;
  }
};

export const deleteSubDocument = async (schoolId, collectionName, id) => {
  try {
    if (!schoolId) return null;
    const res = await api.delete(`/schools/${schoolId}/collections/${collectionName}/${id}`);
    notifyCollectionChange(collectionName, { action: 'delete', id, schoolId });
    return res;
  } catch (error) {
    console.error(`Error deleting document ${id} from ${collectionName}:`, error);
    throw error;
  }
};

// Real-Time SubCollection Subscription via Local Events & Socket.io
export const subscribeToSubCollection = (schoolId, collectionName, callback) => {
  let isSubscribed = true;

  const joinRoom = () => {
    if (schoolId) {
      const token = localStorage.getItem('token');
      socket.emit("join_tenant", { schoolId, token });
    }
  };

  joinRoom();
  socket.on("connect", joinRoom);

  // Initial fetch
  getSubCollection(schoolId, collectionName).then((data) => {
    if (isSubscribed) callback(data || []);
  });

  const refreshData = () => {
    if (!isSubscribed) return;
    getSubCollection(schoolId, collectionName).then((data) => {
      if (isSubscribed) callback(data || []);
    });
  };

  const handleSocketUpdate = (payload) => {
    if (payload.collection === collectionName && isSubscribed) {
      refreshData();
    }
  };

  const handleLocalUpdate = () => {
    if (isSubscribed) {
      refreshData();
    }
  };

  socket.on("collection_change", handleSocketUpdate);
  if (typeof window !== 'undefined') {
    window.addEventListener(`quaders_collection_${collectionName}`, handleLocalUpdate);
  }

  return () => {
    isSubscribed = false;
    socket.off("connect", joinRoom);
    socket.off("collection_change", handleSocketUpdate);
    if (typeof window !== 'undefined') {
      window.removeEventListener(`quaders_collection_${collectionName}`, handleLocalUpdate);
    }
  };
};

// --- School / Tenant Operations ---

export const getSchool = async (schoolId) => {
  try {
    if (!schoolId) return null;
    return await api.get(`/schools/${schoolId}`);
  } catch (error) {
    return null;
  }
};

export const updateSchool = async (schoolId, data) => {
  return await api.put(`/schools/${schoolId}/status`, data);
};

export const subscribeToAllSchools = (callback) => {
  let isSubscribed = true;

  const fetchSchools = async () => {
    try {
      const schools = await api.get('/schools');
      if (isSubscribed) callback(schools || []);
    } catch (e) {
      if (isSubscribed) callback([]);
    }
  };

  fetchSchools();
  const interval = setInterval(fetchSchools, 10000);

  return () => {
    isSubscribed = false;
    clearInterval(interval);
  };
};

export const updateSchoolStatus = async (schoolId, status, permittedModules = [], limits = {}) => {
  return await api.put(`/schools/${schoolId}/status`, {
    status,
    permittedModules,
    ...limits
  });
};

export const updateSchoolLimits = async (schoolId, limits = {}) => {
  return await api.put(`/schools/${schoolId}/status`, limits);
};

export const createSchool = async (data, customId) => {
  return await api.post('/auth/register-school', {
    ...data,
    id: customId
  });
};

export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    id: 'base',
    name: 'Free Trial',
    pricePerUserPerYear: 0,
    userLimit: 100,
    cloudStorageGB: 5,
    active: true,
    modules: {
      staffManagement: true,
      studentManagement: true,
      attendance: true,
      timetable: false,
      feeManagement: false,
      exams: false,
      library: false,
      transport: false,
      lms: false,
      apiIntegration: false
    }
  },
  {
    id: 'standard',
    name: 'Standard Plan',
    pricePerUserPerYear: 499,
    userLimit: 500,
    cloudStorageGB: 25,
    active: true,
    modules: {
      staffManagement: true,
      studentManagement: true,
      attendance: true,
      timetable: true,
      feeManagement: true,
      exams: true,
      library: false,
      transport: false,
      lms: false,
      apiIntegration: false
    }
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    pricePerUserPerYear: 899,
    userLimit: 1500,
    cloudStorageGB: 100,
    active: true,
    modules: {
      staffManagement: true,
      studentManagement: true,
      attendance: true,
      timetable: true,
      feeManagement: true,
      exams: true,
      library: true,
      transport: true,
      lms: true,
      apiIntegration: false
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise Plan',
    pricePerUserPerYear: 1499,
    userLimit: 5000,
    cloudStorageGB: 500,
    active: true,
    custom: false,
    modules: {
      staffManagement: true,
      studentManagement: true,
      attendance: true,
      timetable: true,
      feeManagement: true,
      exams: true,
      library: true,
      transport: true,
      lms: true,
      apiIntegration: true
    }
  }
];

export const getPlans = async () => {
  try {
    const plans = await api.get('/schools/global/collections/subscription_plans');
    if (Array.isArray(plans) && plans.length > 0) {
      return plans;
    }
  } catch (e) {}

  const local = localStorage.getItem('quaders_subscription_plans');
  if (local) {
    try { return JSON.parse(local); } catch (e) {}
  }

  return DEFAULT_SUBSCRIPTION_PLANS;
};

export const subscribeToSubscriptionPlans = (callback) => {
  let isSubscribed = true;

  const fetchAndEmit = async () => {
    const plans = await getPlans();
    if (isSubscribed) callback(plans);
  };

  fetchAndEmit();

  const handleUpdate = (payload) => {
    if (payload.collection === 'subscription_plans' && isSubscribed) {
      fetchAndEmit();
    }
  };

  socket.on('collection_change', handleUpdate);

  return () => {
    isSubscribed = false;
    socket.off('collection_change', handleUpdate);
  };
};

export const updateSubscriptionPlan = async (planId, planData) => {
  try {
    await api.put(`/schools/global/collections/subscription_plans/${planId}`, planData);
  } catch (e) {}

  const current = await getPlans();
  const updated = current.map(p => p.id === planId ? { ...p, ...planData } : p);
  localStorage.setItem('quaders_subscription_plans', JSON.stringify(updated));
  return { id: planId, ...planData };
};

export const initializeDefaultSubscriptionPlans = async () => {
  try {
    for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
      await api.put(`/schools/global/collections/subscription_plans/${plan.id}`, plan);
    }
  } catch (e) {}

  localStorage.setItem('quaders_subscription_plans', JSON.stringify(DEFAULT_SUBSCRIPTION_PLANS));
  return DEFAULT_SUBSCRIPTION_PLANS;
};

export const generateSchoolId = async () => {
  return `SCH_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
};

// --- Attendance Operations ---

export const getAttendance = async (schoolId, classId, date, session) => {
  try {
    return await api.get(`/schools/${schoolId}/attendance`, {
      params: { classId, date, session }
    });
  } catch (error) {
    return [];
  }
};

export const saveAttendance = async (schoolId, attendanceData) => {
  return await api.post(`/schools/${schoolId}/attendance`, attendanceData);
};

export const subscribeToAttendance = (schoolId, classId, date, session, callback) => {
  let isSubscribed = true;

  const fetchAttendance = () => {
    getAttendance(schoolId, classId, date, session).then((res) => {
      if (isSubscribed) callback(res || []);
    });
  };

  fetchAttendance();

  const handleAttendanceChange = (data) => {
    if (data.classId === classId && data.date === date && isSubscribed) {
      fetchAttendance();
    }
  };

  socket.on("attendance_updated", handleAttendanceChange);

  return () => {
    isSubscribed = false;
    socket.off("attendance_updated", handleAttendanceChange);
  };
};

export const getAttendanceForClass = getAttendance;
export const getAttendanceSettings = async () => ({ sessionMode: "twice_daily" });

// --- Students Operations ---

export const getStudentsByClass = async (schoolId, classId) => {
  const students = await getSubCollection(schoolId, 'students');
  return students.filter(s => s.classId === classId);
};

export const subscribeToStudentsByClass = (schoolId, classId, callback) => {
  return subscribeToSubCollection(schoolId, 'students', (allStudents) => {
    callback((allStudents || []).filter(s => s.classId === classId));
  });
};

export const findStudentByAdmission = async (schoolId, admissionNumber, dob) => {
  const students = await getSubCollection(schoolId, 'students');
  const clean = (admissionNumber || '').trim().toLowerCase();
  return students.find(s => {
    const adm = (s.admissionNumber || s.admissionNo || '').trim().toLowerCase();
    if (adm !== clean) return false;
    if (dob && s.dob && s.dob !== dob) return false;
    return true;
  }) || null;
};

// --- Assessments / Grades Operations ---

export const getAssessmentsByClass = async (schoolId, classId) => {
  const all = await getSubCollection(schoolId, 'assessments');
  return all.filter(a => a.classId === classId);
};

export const subscribeToAssessmentsByClass = (schoolId, classId, callback) => {
  return subscribeToSubCollection(schoolId, 'assessments', (all) => {
    callback((all || []).filter(a => a.classId === classId));
  });
};

export const updateAssessmentGrades = async (schoolId, assessmentId, gradesMap) => {
  return await updateSubDocument(schoolId, 'assessments', assessmentId, { grades: gradesMap });
};

export const updateStudentPerformanceStatus = async (schoolId, studentId, status) => {
  return await updateSubDocument(schoolId, 'students', studentId, { performanceStatus: status });
};

// --- PTM Operations ---

export const createPTM = async (schoolId, data) => addSubDocument(schoolId, 'ptm_meetings', data);
export const updatePTM = async (schoolId, id, data) => updateSubDocument(schoolId, 'ptm_meetings', id, data);
export const getPTMs = async (schoolId) => getSubCollection(schoolId, 'ptm_meetings');
export const subscribeToPTMs = (schoolId, callback) => subscribeToSubCollection(schoolId, 'ptm_meetings', callback);
export const subscribeToClassPTMs = (schoolId, classId, callback) => {
  return subscribeToSubCollection(schoolId, 'ptm_meetings', (all) => {
    callback((all || []).filter(p => p.classId === classId));
  });
};

// --- Leave Requests Operations ---

export const applyLeaveRequest = async (schoolId, leaveData) => {
  return await api.post(`/schools/${schoolId}/leaves`, leaveData);
};

export const getLeaveRequests = async (schoolId, filters = {}) => {
  return await api.get(`/schools/${schoolId}/leaves`, { params: filters });
};

export const updateLeaveStatus = async (schoolId, leaveId, status) => {
  return await api.put(`/schools/${schoolId}/leaves/${leaveId}/status`, { status });
};

// --- Fees Operations ---

export const getFeeStructures = async (schoolId) => {
  return await api.get(`/schools/${schoolId}/fees/structures`);
};

export const createFeeStructure = async (schoolId, data) => addSubDocument(schoolId, 'fee_structures', data);
export const getInvoices = async (schoolId) => getSubCollection(schoolId, 'invoices');
export const markInvoicePaid = async (schoolId, invoiceId) => updateSubDocument(schoolId, 'invoices', invoiceId, { status: 'PAID', paidAt: new Date().toISOString() });
export const subscribeToInvoices = (schoolId, callback) => subscribeToSubCollection(schoolId, 'invoices', callback);

export const getStudentInvoices = async (schoolId, studentId) => {
  return await api.get(`/schools/${schoolId}/fees/invoices`, { params: { studentId } });
};

export const payInvoice = async (schoolId, invoiceId) => {
  return await api.put(`/schools/${schoolId}/fees/invoices/${invoiceId}/pay`);
};

// --- Timetable Operations ---

export const saveTimetable = async (schoolId, timetableData) => addSubDocument(schoolId, 'timetables', timetableData);
export const getTimetables = async (schoolId) => getSubCollection(schoolId, 'timetables');
export const subscribeToTimetables = (schoolId, callback) => subscribeToSubCollection(schoolId, 'timetables', callback);

// --- Academic & Entity Operations ---

export const getTeachers = async (schoolId) => getSubCollection(schoolId, 'teachers');
export const getClasses = async (schoolId) => getSubCollection(schoolId, 'classes');
export const getSections = async (schoolId) => getSubCollection(schoolId, 'sections');
export const getSubjects = async (schoolId) => getSubCollection(schoolId, 'subjects');
export const getStudents = async (schoolId) => getSubCollection(schoolId, 'students');

export const saveTeacher = async (schoolId, data) => addSubDocument(schoolId, 'teachers', data);
export const saveClass = async (schoolId, data) => addSubDocument(schoolId, 'classes', data);
export const saveSection = async (schoolId, data) => addSubDocument(schoolId, 'sections', data);
export const saveSubject = async (schoolId, data) => addSubDocument(schoolId, 'subjects', data);
export const saveStudent = async (schoolId, data) => addSubDocument(schoolId, 'students', data);

// --- Environment / Setup Operations ---

export const subscribeToFeeCollectionPeriods = (schoolId, callback) => subscribeToSubCollection(schoolId, 'fee_periods', callback);
export const createFeeCollectionPeriod = (schoolId, data) => addSubDocument(schoolId, 'fee_periods', data);
export const updateFeeCollectionPeriod = (schoolId, id, data) => updateSubDocument(schoolId, 'fee_periods', id, data);
export const deleteFeeCollectionPeriod = (schoolId, id) => deleteSubDocument(schoolId, 'fee_periods', id);

export const subscribeToLeaveApprovalRules = (schoolId, callback) => subscribeToSubCollection(schoolId, 'leave_rules', callback);
export const createLeaveApprovalRule = (schoolId, data) => addSubDocument(schoolId, 'leave_rules', data);
export const updateLeaveApprovalRule = (schoolId, id, data) => updateSubDocument(schoolId, 'leave_rules', id, data);
export const deleteLeaveApprovalRule = (schoolId, id) => deleteSubDocument(schoolId, 'leave_rules', id);

export const saveAttendanceSettings = async (schoolId, settings) => updateSubDocument(schoolId, 'settings', 'attendance', settings);
export const subscribeToPlans = (callback) => { getPlans().then(callback); return () => {}; };
export const subscribeToAttendanceForClass = subscribeToAttendance;

// --- Transport Operations ---

export const createTransportRoute = async (schoolId, data) => addSubDocument(schoolId, 'transport_routes', data);
export const assignStudentToRoute = async (schoolId, routeId, studentId) => updateSubDocument(schoolId, 'students', studentId, { transportRouteId: routeId });
export const subscribeToTransportRoutes = (schoolId, callback) => subscribeToSubCollection(schoolId, 'transport_routes', callback);

// --- Library Operations ---

export const getBooks = async (schoolId) => getSubCollection(schoolId, 'library_books');
export const addBook = async (schoolId, data) => addSubDocument(schoolId, 'library_books', data);
export const getIssuedBooks = async (schoolId) => getSubCollection(schoolId, 'issued_books');
export const issueBook = async (schoolId, data) => addSubDocument(schoolId, 'issued_books', data);
export const returnBook = async (schoolId, issueId) => updateSubDocument(schoolId, 'issued_books', issueId, { status: 'RETURNED', returnedAt: new Date().toISOString() });
export const subscribeToBooks = (schoolId, callback) => subscribeToSubCollection(schoolId, 'library_books', callback);
export const subscribeToIssuedBooks = (schoolId, callback) => subscribeToSubCollection(schoolId, 'issued_books', callback);

// --- Exams, Assessments & Report Cards Operations ---

export const getExams = async (schoolId, params = {}) => {
  try {
    return await api.get('/v1/exams', { params });
  } catch (error) {
    console.error('getExams error, falling back to collections:', error);
    return getSubCollection(schoolId, 'exams');
  }
};

export const createExam = async (schoolId, data) => {
  try {
    const res = await api.post('/v1/exams', data);
    return res.exam || res;
  } catch (error) {
    console.error('createExam error, falling back to collections:', error);
    return addSubDocument(schoolId, 'exams', data);
  }
};

export const saveExam = async (schoolId, data) => createExam(schoolId, data);

export const updateExamStatus = async (examId, status) => {
  return await api.post(`/v1/exams/${examId}/status`, { status });
};

export const getExamProgress = async (examId) => {
  return await api.get(`/v1/exams/${examId}/progress`);
};

export const deleteExam = async (schoolId, examId) => {
  try {
    return await api.delete(`/v1/exams/${examId}`);
  } catch (error) {
    return deleteSubDocument(schoolId, 'exams', examId);
  }
};

export const getAssessments = async (params = {}) => {
  return await api.get('/v1/assessments', { params });
};

export const createAssessment = async (schoolId, data) => {
  return await api.post('/v1/assessments', data);
};

export const getAssessmentGrades = async (assessmentId) => {
  return await api.get(`/v1/assessments/${assessmentId}/grades`);
};

export const bulkSaveAssessmentGrades = async (assessmentId, gradesData) => {
  return await api.post(`/v1/assessments/${assessmentId}/grades/bulk`, gradesData);
};

export const overrideAssessmentGrade = async (assessmentId, studentId, gradeData) => {
  return await api.put(`/v1/assessments/${assessmentId}/grades/${studentId}`, gradeData);
};

export const previewReportCards = async (previewData) => {
  return await api.post('/v1/report-cards/preview', previewData);
};

export const publishReportCards = async (publishData) => {
  return await api.post('/v1/report-cards/publish', publishData);
};

export const getStudentReportCards = async (studentId) => {
  return await api.get(`/v1/report-cards/student/${studentId}`);
};

export const getReportCardTemplate = async (type = 'CBSE') => {
  return await api.get(`/v1/report-card-templates/${type}`);
};

export const saveReportCardTemplate = async (templateData, type = 'CBSE') => {
  return await api.put(`/v1/report-card-templates/${type}`, templateData);
};

export const getTemplate = async (schoolId, templateId = 'CBSE') => {
  try {
    return await getReportCardTemplate(templateId);
  } catch (e) {
    return { id: templateId };
  }
};

export const saveTemplate = async (schoolId, templateId, templateData) => {
  try {
    return await saveReportCardTemplate(templateData, templateId);
  } catch (e) {
    return addSubDocument(schoolId, 'report_templates', templateData);
  }
};

export const subscribeToExams = (schoolId, callback) => {
  let isSubscribed = true;
  if (schoolId) socket.emit('join_tenant', schoolId);

  const fetchAndEmit = () => {
    getExams(schoolId).then((data) => {
      if (isSubscribed) callback(Array.isArray(data) ? data : []);
    });
  };

  fetchAndEmit();

  const handleUpdate = () => {
    if (isSubscribed) fetchAndEmit();
  };

  socket.on('exam_created', handleUpdate);
  socket.on('exam_updated', handleUpdate);
  socket.on('exam_status_updated', handleUpdate);
  socket.on('exam_deleted', handleUpdate);

  return () => {
    isSubscribed = false;
    socket.off('exam_created', handleUpdate);
    socket.off('exam_updated', handleUpdate);
    socket.off('exam_status_updated', handleUpdate);
    socket.off('exam_deleted', handleUpdate);
  };
};

export const getExamAssessments = async (schoolId, classId, examId) => {
  try {
    return await getAssessments({ classId, examinationId: examId });
  } catch (e) {
    return getSubCollection(schoolId, 'exam_assessments');
  }
};

export const getExamResults = async (schoolId) => getSubCollection(schoolId, 'exam_results');
export const saveExamResult = async (schoolId, data) => addSubDocument(schoolId, 'exam_results', data);

// --- Settings & Integrations ---

export const updateSchoolAPIKeys = async (schoolId, keys) => updateSubDocument(schoolId, 'settings', 'api_keys', keys);
export const getSubscriptionPlans = getPlans;

// --- Other Modules ---

export const getInventory = async (schoolId) => getSubCollection(schoolId, 'inventory');
export const addInventoryItem = async (schoolId, data) => addSubDocument(schoolId, 'inventory', data);
export const updateInventoryItem = async (schoolId, id, data) => updateSubDocument(schoolId, 'inventory', id, data);
export const deleteInventoryItem = async (schoolId, id) => deleteSubDocument(schoolId, 'inventory', id);
export const subscribeToInventory = (schoolId, callback) => subscribeToSubCollection(schoolId, 'inventory', callback);

export const getCanteenItems = async (schoolId) => getSubCollection(schoolId, 'canteen');
export const addCanteenItem = async (schoolId, data) => addSubDocument(schoolId, 'canteen', data);
export const updateCanteenItem = async (schoolId, id, data) => updateSubDocument(schoolId, 'canteen', id, data);
export const deleteCanteenItem = async (schoolId, id) => deleteSubDocument(schoolId, 'canteen', id);
export const subscribeToCanteen = (schoolId, callback) => subscribeToSubCollection(schoolId, 'canteen', callback);

export const createHomework = async (schoolId, data) => addSubDocument(schoolId, 'homework', data);
export const getHomeworkByClass = async (schoolId, classId) => {
  const all = await getSubCollection(schoolId, 'homework');
  return all.filter(h => h.classId === classId);
};
export const subscribeToHomework = (schoolId, callback) => subscribeToSubCollection(schoolId, 'homework', callback);

// --- Noticeboard Operations ---

export const createNotice = async (schoolId, noticeData) => {
  return await addSubDocument(schoolId, 'notices', noticeData);
};

export const getNotices = async (schoolId) => getSubCollection(schoolId, 'notices');

export const subscribeToNotices = (schoolId, audienceOrCb, callback) => {
  const cb = typeof audienceOrCb === 'function' ? audienceOrCb : callback;
  const audience = typeof audienceOrCb === 'string' ? audienceOrCb : null;
  return subscribeToSubCollection(schoolId, 'notices', (data) => {
    let filtered = data || [];
    if (audience && audience !== 'all') {
      filtered = filtered.filter(n => !n.audience || n.audience === audience || n.audience === 'all');
    }
    if (typeof cb === 'function') {
      cb(filtered);
    }
  });
};

export const subscribeToGlobalNotices = (schoolId, audienceOrCb, callback) => {
  const cb = typeof audienceOrCb === 'function' ? audienceOrCb : callback;
  const audience = typeof audienceOrCb === 'string' ? audienceOrCb : null;
  return subscribeToSubCollection(schoolId, 'notices', (allNotices) => {
    let filtered = (allNotices || []).filter(n => !n.classId || n.isGlobal);
    if (audience && audience !== 'all') {
      filtered = filtered.filter(n => !n.audience || n.audience === audience || n.audience === 'all');
    }
    if (typeof cb === 'function') {
      cb(filtered);
    }
  });
};

export const subscribeToClassNotices = (schoolId, classId, callback) => {
  return subscribeToSubCollection(schoolId, 'notices', (allNotices) => {
    callback((allNotices || []).filter(n => n.classId === classId));
  });
};

export const deleteNotice = async (schoolId, noticeId) => {
  return await deleteSubDocument(schoolId, 'notices', noticeId);
};

export const updateNotice = async (schoolId, noticeId, data) => {
  return await updateSubDocument(schoolId, 'notices', noticeId, data);
};

export const markNoticeAsViewed = async () => {};

// --- Other Compatibility Helpers ---

export const getTransportRoutes = async (schoolId) => getSubCollection(schoolId, 'transport_routes');
export const checkParentRegistration = async () => false;
export const deleteChatMessage = async (schoolId, msgId) => deleteSubDocument(schoolId, 'messages', msgId);
export const updateChatRoomStatus = async () => {};
export const subscribeToChatRoom = (s, st, t, cb) => { cb(null); return () => {}; };
export const getChatsForTeacher = async () => [];
export const markChatRead = async () => {};
export const createChannel = async (s, data) => addSubDocument(s, 'channels', data);
export const getChannelsForUser = async (s) => getSubCollection(s, 'channels');
export const subscribeToChannelMessages = (s, c, cb) => subscribeToSubCollection(s, `channel_${c}_messages`, cb);
export const sendChannelMessage = async (s, c, data) => addSubDocument(s, `channel_${c}_messages`, data);
export const subscribeToMessages = (s, r, cb) => subscribeToSubCollection(s, `room_${r}_messages`, cb);
export const sendMessage = async (s, r, data) => addSubDocument(s, `room_${r}_messages`, data);
export const getChatThreads = async (schoolId) => getSubCollection(schoolId, 'chat_threads');
export const cleanupOldChatAudio = async () => {};
export const updateStudentRunningStatsAndFlags = async () => {};
export const unlinkStudentFromParent = async (userId, studentId) => {
  return await api.post('/auth/unlink-student', { studentId });
};
export const linkStudentToParent = async (userId, studentId, classId, studentName) => {
  return await api.post('/auth/link-student', { studentId, classId, studentName });
};
export const switchActiveStudent = async (userId, studentId, classId) => {
  return await api.post('/auth/switch-student', { studentId, classId });
};
export const subscribeToStudentPTMs = (schoolId, studentId, callback) => {
  return subscribeToSubCollection(schoolId, 'ptm_meetings', (all) => {
    callback((all || []).filter(p => p.studentId === studentId));
  });
};
export const getTeachersForChat = async (schoolId) => getSubCollection(schoolId, 'teachers');
export const uploadChatMedia = async (file) => {
  // Convert file to base64 or return object URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
};

