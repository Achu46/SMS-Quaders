import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getSubCollection, updateSubDocument, addSubDocument, subscribeToSubCollection, deleteSubDocument } from '../../firebase/firestore';
import { doc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { db, socket } from '../../firebase/config';
import { uploadFileToCloudinaryOrFirebase, uploadCustomDataFiles } from '../../utils/cloudinary';
import { LuSearch as Search, LuShieldCheck as ShieldCheck, LuMail as Mail, LuUsers as Users, LuCircleCheck as CheckCircle2, LuX as X, LuCloudUpload as UploadCloud, LuFileText as FileText, LuExternalLink as ExternalLink, LuDownload as Download, LuFileSpreadsheet as FileSpreadsheet, LuUserPlus as UserPlus, LuEye as Eye, LuFilter as Filter, LuLink as LinkIcon, LuCopy as CopyIcon, LuTrash2 as Trash, LuFileDown as FileDown, LuGraduationCap as GraduationCap, LuBriefcase as Briefcase, LuBuilding2 as Building2, LuCreditCard as CreditCard, LuIdCard as IdCard, LuUser as User, LuPhone as Phone, LuCalendar as Calendar, LuMapPin as MapPin, LuBadgeCheck as BadgeCheck, LuInfo as Info, LuCheck as Check, LuFileUp as FileUp, LuCircleAlert as CircleAlert } from 'react-icons/lu';
import { TableSkeleton } from '../../components/Skeleton';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import CustomFieldsRenderer from '../../components/CustomFieldsRenderer';
import ConfirmModal from '../../components/ConfirmModal';
import FilePreviewModal from '../../components/FilePreviewModal';
import usePermissions from '../../hooks/usePermissions';
import { sortClassesAscending } from '../../utils/classSorting';
import { normalizeGender, isMale, isFemale } from '../../utils/genderUtils';

const STAFF_TABS = [
  { id: 'Personal', label: 'Personal', icon: User },
  { id: 'Educational', label: 'Educational', icon: GraduationCap },
  { id: 'Professional', label: 'Professional', icon: Briefcase },
  { id: 'Government & Identity', label: 'Government & Identity', icon: IdCard },
  { id: 'Employment', label: 'Employment', icon: Building2 },
  { id: 'Banking', label: 'Banking', icon: CreditCard },
  { id: 'Uploads', label: 'Uploads', icon: UploadCloud }
];

const TAB_ERROR_FIELDS = {
  Personal: ['staffId', 'firstName', 'lastName', 'email', 'mobileNumber', 'emergencyContact', 'roleId'],
  Educational: ['yearOfPassing'],
  Professional: ['previousExperience'],
  'Government & Identity': ['aadharNumber', 'panNumber'],
  Employment: [],
  Banking: ['bankAccountNumber', 'ifscCode'],
  Uploads: []
};

export default function StaffAssignment() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [rolesList, setRolesList] = useState([]);
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('staff');
  const hasEditPermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('staff');
  const hasDeletePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('staff');

  const [staff, setStaff] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [genderFilter, setGenderFilter] = useState('all');

  // Assignment Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectClassIds, setSelectedSubjectClassIds] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [saving, setSaving] = useState(false);

  // Upload Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedStaffForUpload, setSelectedStaffForUpload] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [confirmDeleteState, setConfirmDeleteState] = useState({ isOpen: false, id: null, name: '' });
  const [allRoles, setAllRoles] = useState([]);
  const [backendStaffMap, setBackendStaffMap] = useState({});

  // Staff Invite Modal State
  const [inviteModal, setInviteModal] = useState({
    isOpen: false,
    staffId: null,
    staffName: '',
    staffEmail: '',
    staffEmpId: '',
    inviteUrl: '',
    expiresAt: null,
    status: 'NONE',
    loading: false,
    emailSending: false
  });

  const fetchRoles = async () => {
    try {
      const data = await api.get('/roles');
      if (Array.isArray(data)) {
        setRolesList(data);
        setAllRoles(data.map(r => r.name));
      } else {
        setRolesList([]);
        setAllRoles([]);
      }
    } catch (err) {
      console.error('Error fetching custom roles:', err);
      setRolesList([]);
      setAllRoles([]);
    }
  };

  const getStaffRoleName = (member) => {
    const backendUser = (member.userId && backendStaffMap[member.userId]) || (member.email && backendStaffMap[member.email?.toLowerCase()]) || (member.staffId && backendStaffMap[member.staffId]);
    const activeRoleId = backendUser?.roleId || member.roleId;
    const matchedRole = rolesList.find(r => r.id === activeRoleId);
    return matchedRole?.name || member.customRole?.name || member.role || (member.roles && member.roles[0]) || 'No Role';
  };

  const loadBackendStaff = async () => {
    try {
      const bStaff = await api.get('/staff');
      if (Array.isArray(bStaff)) {
        const map = {};
        bStaff.forEach(s => {
          if (s.id) map[s.id] = s;
          if (s.email) map[s.email.toLowerCase()] = s;
          if (s.employeeId) map[s.employeeId] = s;
        });
        setBackendStaffMap(map);
      }
    } catch (e) {
      console.warn('Could not fetch backend staff:', e);
    }
  };

  const openInviteModal = async (member) => {
    const backendUser = (member.userId && backendStaffMap[member.userId]) || (member.email && backendStaffMap[member.email?.toLowerCase()]) || (member.staffId && backendStaffMap[member.staffId]);
    const staffId = backendUser?.id || member.userId || member.id;
    const staffName = member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Staff Member';
    const staffEmail = member.email || '';
    const staffEmpId = member.staffId || member.employeeId || '';

    setInviteModal({
      isOpen: true,
      staffId,
      staffName,
      staffEmail,
      staffEmpId,
      inviteUrl: '',
      expiresAt: null,
      status: 'LOADING',
      loading: true,
      emailSending: false
    });

    try {
      // Generate or retrieve active invite URL
      const genRes = await api.post(`/staff/${staffId}/invite`, {
        email: staffEmail,
        employeeId: staffEmpId
      });
      setInviteModal(prev => ({
        ...prev,
        inviteUrl: genRes.inviteUrl,
        expiresAt: genRes.expiresAt,
        status: 'ACTIVE',
        loading: false
      }));
    } catch (err) {
      console.error('Error generating invite:', err);
      toast.error(err.message || 'Failed to generate invite link');
      setInviteModal(prev => ({ ...prev, loading: false, status: 'ERROR' }));
    }
  };

  const handleRegenerateInvite = async () => {
    if (!inviteModal.staffId) return;
    setInviteModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await api.post(`/staff/${inviteModal.staffId}/invite`, {
        email: inviteModal.staffEmail,
        employeeId: inviteModal.staffEmpId
      });
      setInviteModal(prev => ({
        ...prev,
        inviteUrl: res.inviteUrl,
        expiresAt: res.expiresAt,
        status: 'ACTIVE',
        loading: false
      }));
      toast.success('Registration invite link regenerated!');
    } catch (err) {
      toast.error(err.message || 'Failed to regenerate invite link');
      setInviteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSendInviteEmail = async () => {
    if (!inviteModal.staffId) return;
    setInviteModal(prev => ({ ...prev, emailSending: true }));
    try {
      await api.post(`/staff/${inviteModal.staffId}/invite/send-email`);
      toast.success(`Invite email sent to ${inviteModal.staffEmail}`);
    } catch (err) {
      toast.error(err.message || 'Failed to send invite email');
    } finally {
      setInviteModal(prev => ({ ...prev, emailSending: false }));
    }
  };

  const handleCopyInviteLink = () => {
    if (!inviteModal.inviteUrl) return;
    navigator.clipboard.writeText(inviteModal.inviteUrl);
    toast.success('Link copied to clipboard!');
  };

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [selectedFields, setSelectedFields] = useState({
    name: true,
    email: true,
    role: true,
    assignedClass: true,
    subjectClasses: true,
    mobile: true,
    qualification: true
  });

  const handleFieldToggle = (field) => {
    setSelectedFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleDeleteStaff = async (staffId) => {
    try {
      await deleteSubDocument(schoolId, 'teachers', staffId);
      toast.success("Staff member deleted successfully!");
      setConfirmDeleteState({ isOpen: false, id: null, name: '' });
    } catch (error) {
      console.error("Error deleting staff member:", error);
      toast.error("Failed to delete staff member.");
    }
  };

  // Add Staff Modal State
  const initialStaffFormState = {
    staffId: '',
    firstName: '',
    lastName: '',
    dob: '',
    gender: 'Male',
    nationality: '',
    maritalStatus: 'Single',
    bloodGroup: '',
    aadharNumber: '',
    languagesKnown: '',
    mobileNumber: '',
    email: '',
    residentialAddress: '',
    emergencyContact: '',
    fatherGuardianName: '',
    roleId: '',
    role: '',
    roles: [],
    assignedClassId: '',
    staff_type: 'teaching',
    status: 'Invited',
    
    // Educational Information
    highestQualification: '',
    degreeSpecialization: '',
    universityName: '',
    yearOfPassing: '',

    // Professional Information
    previousExperience: '0',
    previousOrganization: '',
    subjectSpecialization: '',
    gradesClassesHandled: '',
    professionalCertifications: '',

    // Government & Identity
    govtIdType: 'Aadhaar',
    govtIdNumber: '',
    panNumber: '',
    taxIdDetails: '',

    // Employment Details
    pfNumber: '',
    esicNumber: '',
    uanNumber: '',

    // Banking Information
    bankAccountNumber: '',
    bankName: '',
    branchName: '',
    ifscCode: '',

    // Documents (URLs)
    photoUrl: '',
    academicCertificates: [],
    markSheets: [],
    experienceCertificates: [],
    relievingLetter: [],
    resume: [],
    referenceLetters: [],
    govtIdDocument: [],
    salarySlips: [],
    
    // Custom Data
    customData: {}
  };

  const [addStaffModalOpen, setAddStaffModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState(initialStaffFormState);
  const [addingStaff, setAddingStaff] = useState(false);
  const [addStaffActiveTab, setAddStaffActiveTab] = useState('Personal');
  const [addStaffErrors, setAddStaffErrors] = useState({});
  const [addStaffFiles, setAddStaffFiles] = useState({
    photo: null,
    academicCertificates: [],
    markSheets: [],
    experienceCertificates: [],
    relievingLetter: [],
    resume: [],
    referenceLetters: [],
    govtIdDocument: [],
    salarySlips: []
  });

  // View Modal State
  const [viewStaffModalOpen, setViewStaffModalOpen] = useState(false);
  const [selectedStaffToView, setSelectedStaffToView] = useState(null);
  const [isStaffEditMode, setIsStaffEditMode] = useState(false);
  const [editStaffData, setEditStaffData] = useState(null);
  const [editStaffErrors, setEditStaffErrors] = useState({});
  const [savingStaffEdit, setSavingStaffEdit] = useState(false);
  const [editStaffDocFiles, setEditStaffDocFiles] = useState({});

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [staffTypeFilter, setStaffTypeFilter] = useState('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const activeTabRef = useRef(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [addStaffActiveTab]);

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let teachersUnsub, classesUnsub, subjectsUnsub;

    // Fetch school name once
    getDoc(doc(db, 'schools', schoolId)).then(snap => {
      if (snap && (typeof snap.exists === 'function' ? snap.exists() : snap.exists)) {
        setSchoolName(snap.data()?.schoolName || 'School');
      }
    }).catch(err => console.warn('Could not fetch school name:', err));

    teachersUnsub = subscribeToSubCollection(schoolId, 'teachers', (data) => {
      setStaff(data);
      setLoading(false);
    });

    classesUnsub = subscribeToSubCollection(schoolId, 'classes', (data) => {
      setClasses(sortClassesAscending(data));
    });

    subjectsUnsub = subscribeToSubCollection(schoolId, 'subjects', setSubjects);

    fetchRoles();
    loadBackendStaff();

    return () => {
      if (teachersUnsub) teachersUnsub();
      if (classesUnsub) classesUnsub();
      if (subjectsUnsub) subjectsUnsub();
    };
  }, [schoolId]);


  // Reactive sync on focus, socket permissions-updated, and custom permissions_changed events
  useEffect(() => {
    const handleSync = () => {
      fetchRoles();
      loadBackendStaff();
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('quaders:permissions_changed', handleSync);
    if (socket) {
      socket.on('permissions-updated', handleSync);
    }

    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('quaders:permissions_changed', handleSync);
      if (socket) {
        socket.off('permissions-updated', handleSync);
      }
    };
  }, []);

  // Click outside to close filter dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const openAssignModal = (staffMember) => {
    setSelectedStaff(staffMember);
    setSelectedClassId(staffMember.assignedClassId || '');
    setSelectedSubjectClassIds(staffMember.subjectClassIds || []);
    
    // Derive selected subjects based on the subjects' assignedTeacherIds
    const currentlyAssignedSubjects = subjects
      .filter(s => s.assignedTeacherIds && s.assignedTeacherIds.includes(staffMember.id))
      .map(s => s.id);
    setSelectedSubjectIds(currentlyAssignedSubjects);

    setAssignModalOpen(true);
  };



  const handleAssign = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);

      const teacherRef = doc(db, `schools/${schoolId}/teachers`, selectedStaff.id);
      batch.update(teacherRef, {
        assignedClassId: selectedClassId,
        subjectClassIds: selectedSubjectClassIds,
        assignedSubjectIds: selectedSubjectIds
      });

      subjects.forEach(subject => {
        const isSelected = selectedSubjectIds.includes(subject.id);
        const hasTeacher = (subject.assignedTeacherIds || []).includes(selectedStaff.id);
        
        if (isSelected && !hasTeacher) {
          const subjectRef = doc(db, `schools/${schoolId}/subjects`, subject.id);
          batch.update(subjectRef, {
            assignedTeacherIds: [...(subject.assignedTeacherIds || []), selectedStaff.id]
          });
        } else if (!isSelected && hasTeacher) {
          const subjectRef = doc(db, `schools/${schoolId}/subjects`, subject.id);
          batch.update(subjectRef, {
            assignedTeacherIds: (subject.assignedTeacherIds || []).filter(id => id !== selectedStaff.id)
          });
        }
      });

      await batch.commit();

      setAssignModalOpen(false);
      toast.success("Assignments updated successfully.");
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error("Failed to assign classes/subjects.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadModalOpen(false);

    // BULK IMPORT LOGIC
      const loadingToastId = toast.loading("Processing bulk import...");
      try {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

            if (rawData.length === 0) {
              toast.error('The file appears to be empty or has no data rows.', { id: loadingToastId });
              setUploading(false);
              return;
            }

            // Helper: get value from a row using multiple possible key variants (case+space insensitive)
            const getField = (row, ...aliases) => {
              const normalizedRow = {};
              Object.keys(row).forEach(k => {
                normalizedRow[k.trim().toLowerCase().replace(/\s+/g, ' ')] = row[k];
              });
              for (const alias of aliases) {
                const val = normalizedRow[alias.trim().toLowerCase().replace(/\s+/g, ' ')];
                if (val !== undefined && String(val).trim() !== '') return String(val).trim();
              }
              return '';
            };

            let successCount = 0;
            let skippedCount = 0;

            for (let i = 0; i < rawData.length; i++) {
              const row = rawData[i];

              // Support both "Full Name" (single col) and "First Name" / "Last Name" (split cols)
              let firstName = getField(row, 'first name', 'firstname', 'first_name');
              let lastName = getField(row, 'last name', 'lastname', 'last_name', 'surname');
              const fullName = getField(row, 'full name', 'fullname', 'name', 'staff name');
              if (!firstName && fullName) {
                const parts = fullName.trim().split(' ');
                firstName = parts[0];
                lastName = parts.slice(1).join(' ') || parts[0];
              }

              // Fallbacks to avoid undefined / skip failures
              if (!firstName) firstName = 'Staff';
              const email = getField(row, 'email address', 'email', 'emailaddress', 'email_address', 'mail');

              // Map all Excel columns to Firestore fields
              const staffData = {
                staffId:                  getField(row, 'staff id', 'staffid', 'staff_id', 'id'),
                firstName,
                lastName,
                name:                     `${firstName} ${lastName}`.trim(),
                dob:                      getField(row, 'date of birth', 'dob', 'birth date'),
                gender:                   normalizeGender(getField(row, 'gender', 'sex', 'staff gender', 'staff_gender'), 'Male'),
                nationality:              getField(row, 'nationality'),
                maritalStatus:            getField(row, 'marital status', 'marital_status'),
                bloodGroup:               getField(row, 'blood group', 'bloodgroup', 'blood_group'),
                aadharNumber:             getField(row, 'aadhar number', 'aadhar', 'aadhaar number', 'aadhaar'),
                languagesKnown:           getField(row, 'languages known', 'languages', 'language'),
                mobileNumber:             getField(row, 'mobile number', 'mobile', 'phone', 'contact', 'phone number'),
                email,
                residentialAddress:       getField(row, 'residential address', 'address', 'residence'),
                emergencyContact:         getField(row, 'emergency contact details', 'emergency contact', 'emergency'),
                fatherName:               getField(row, 'father name/guardian name', 'father name', 'guardian name', 'father/guardian'),
                highestQualification:     getField(row, 'highest qualification', 'qualification'),
                degreeSpecialization:     getField(row, 'degree(s) and specialization', 'degree and specialization', 'degree', 'specialization'),
                universityName:           getField(row, 'university/college name', 'university', 'college', 'institution'),
                yearOfPassing:            getField(row, 'year of passing', 'year passing', 'passing year'),
                previousExperience:       getField(row, 'previous experience (years)', 'previous experience', 'experience years', 'experience'),
                previousOrganization:     getField(row, 'previous school/organization', 'previous school', 'previous organization', 'organization'),
                subjectSpecialization:    getField(row, 'subject specialization', 'subject', 'subjects'),
                gradesClassesHandled:     getField(row, 'grades/classes handled', 'grades', 'classes handled'),
                professionalCertifications: getField(row, 'certifications', 'professional certifications', 'certification'),
                govtIdNumber:             getField(row, 'government-issued id', 'government id', 'govt id', 'govt_id'),
                taxIdDetails:             getField(row, 'tax identification details (pan)', 'tax identification', 'tax id'),
                panNumber:                getField(row, 'pan number', 'pan', 'pan_number'),
                pfNumber:                 getField(row, 'pf number', 'pf', 'provident fund'),
                esicNumber:               getField(row, 'esic number', 'esic'),
                uanNumber:                getField(row, 'uan number', 'uan'),
                bankAccountNumber:        getField(row, 'bank account number', 'account number', 'bank account'),
                bankName:                 getField(row, 'bank name and branch', 'bank name', 'bank'),
                branchName:               getField(row, 'branch name', 'branch'),
                ifscCode:                 getField(row, 'ifsc code', 'ifsc'),
                role:                     getField(row, 'role', 'designation', 'position') || 'Staffs',
                staff_type:               getField(row, 'staff type', 'stafftype', 'type') || 'teaching',
                assignedClassId:          getField(row, 'assigned class id', 'class id', 'classid'),
                status: 'Active',
                createdAt: new Date().toISOString()
              };

              // Remove empty string values to keep Firestore docs clean
              Object.keys(staffData).forEach(k => { if (staffData[k] === '') delete staffData[k]; });

              await addSubDocument(schoolId, 'teachers', staffData);
              successCount++;
            }

            const skippedMsg = skippedCount > 0 ? ` (${skippedCount} row(s) skipped — missing required fields)` : '';
            toast.success(`Successfully imported ${successCount} staff member(s)!${skippedMsg}`, { id: loadingToastId });
            setUploadModalOpen(false);
            setUploadFile(null);
          } catch (innerErr) {
            console.error("Bulk import processing error:", innerErr);
            toast.error(`Import failed: ${innerErr.message || 'Check file format.'}`, { id: loadingToastId });
          } finally {
            setUploading(false);
          }
        };
        reader.onerror = () => {
          toast.error("Failed to read the file.", { id: loadingToastId });
          setUploading(false);
        };
        reader.readAsBinaryString(uploadFile);
      } catch (err) {
        console.error(err);
        toast.error("Failed to process file.", { id: loadingToastId });
        setUploading(false);
      }
  };

  const handleSaveStaffEdit = async () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editStaffData.firstName?.trim()) errors.firstName = 'First name is required';
    if (!editStaffData.email?.trim()) errors.email = 'Email is required';
    else if (!emailRegex.test(editStaffData.email.trim())) errors.email = 'Invalid email format';
    if (editStaffData.mobileNumber?.trim() && !/^\d{10}$/.test(editStaffData.mobileNumber.trim())) {
      errors.mobileNumber = 'Mobile number must be 10 digits';
    }
    if (editStaffData.aadharNumber?.trim() && !/^\d{12}$/.test(editStaffData.aadharNumber.trim())) {
      errors.aadharNumber = 'Aadhaar number must be 12 digits';
    }
    // Check for duplicate email/staffId (excluding self, ONLY if changed)
    const currentEmail = (editStaffData.email || '').trim().toLowerCase();
    const originalEmail = (selectedStaffToView.email || '').trim().toLowerCase();
    const emailChanged = currentEmail !== originalEmail;
    const isDupEmail = emailChanged && currentEmail !== '' && staff.some(s => s.id !== selectedStaffToView.id && (s.email || '').trim().toLowerCase() === currentEmail);
    if (isDupEmail) errors.email = 'Email already in use by another staff member';
    
    const currentStaffId = (editStaffData.staffId || '').trim().toLowerCase();
    const originalStaffId = (selectedStaffToView.staffId || '').trim().toLowerCase();
    const staffIdChanged = currentStaffId !== originalStaffId;
    const isDupId = staffIdChanged && currentStaffId !== '' && staff.some(s => s.id !== selectedStaffToView.id && (s.staffId || '').trim().toLowerCase() === currentStaffId);
    if (isDupId) errors.staffId = 'Staff ID already in use';

    setEditStaffErrors(errors);
    if (Object.keys(errors).length > 0) {
      setAddStaffActiveTab('Personal Info');
      toast.error('Please fix the highlighted errors in Personal Info.');
      return;
    }

    setSavingStaffEdit(true);
    try {
      // Upload any new document files first
      const docCategories = [
        'academicCertificates', 'markSheets', 'experienceCertificates',
        'relievingLetter', 'resume', 'referenceLetters', 'govtIdDocument', 'salarySlips'
      ];
      const docUpdates = {};
      const safeSchoolName = schoolName.replace(/[^a-z0-9]/gi, '_').trim();
      const staffName = ((editStaffData.firstName || '') + '_' + (editStaffData.lastName || '')).replace(/[^a-z0-9]/gi, '_').trim();

      for (const cat of docCategories) {
        const newFiles = editStaffDocFiles[cat] || [];
        const existingDocs = editStaffData[cat] || []; // Use editStaffData since it can be modified (files deleted)
        
        // If there are new files to upload, or if the user deleted an existing file:
        if (newFiles.length > 0 || (editStaffData[cat] !== undefined && editStaffData[cat].length !== (selectedStaffToView[cat] || []).length)) {
          const uploadedDocs = [];
          for (const file of newFiles) {
            const safeFileName = file.name.replace(/[^a-z0-9.]/gi, '_');
            const storagePath = `${safeSchoolName}/Teachers/${staffName}/${cat}/${safeFileName}`;
            const url = await uploadFileToCloudinaryOrFirebase(file, schoolId, storagePath);
            uploadedDocs.push({ name: file.name, url });
          }
          docUpdates[cat] = [...existingDocs, ...uploadedDocs];
        }
      }
      const uploadedCustomData = await uploadCustomDataFiles(editStaffData.customData, schoolId, 'staff');

      const updateData = {
        ...docUpdates,
        staffId:          (editStaffData.staffId || '').trim(),
        employeeId:       (editStaffData.staffId || '').trim(),
        firstName:        (editStaffData.firstName || '').trim(),
        lastName:         (editStaffData.lastName || '').trim(),
        name:             `${(editStaffData.firstName || '').trim()} ${(editStaffData.lastName || '').trim()}`.trim(),
        dob:              (editStaffData.dob || '').trim(),
        gender:           editStaffData.gender || 'Male',
        nationality:      (editStaffData.nationality || '').trim(),
        maritalStatus:    editStaffData.maritalStatus || 'Single',
        bloodGroup:       (editStaffData.bloodGroup || '').trim(),
        aadharNumber:     (editStaffData.aadharNumber || '').trim(),
        languagesKnown:   (editStaffData.languagesKnown || '').trim(),
        mobileNumber:     (editStaffData.mobileNumber || '').trim(),
        email:            (editStaffData.email || '').trim(),
        residentialAddress: (editStaffData.residentialAddress || '').trim(),
        emergencyContact: (editStaffData.emergencyContact || '').trim(),
        fatherName:       (editStaffData.fatherName || '').trim(),
        highestQualification: (editStaffData.highestQualification || '').trim(),
        degreeSpecialization: (editStaffData.degreeSpecialization || '').trim(),
        universityName:   (editStaffData.universityName || '').trim(),
        yearOfPassing:    (editStaffData.yearOfPassing || '').trim(),
        previousExperience: (editStaffData.previousExperience || '').trim(),
        previousOrganization: (editStaffData.previousOrganization || '').trim(),
        subjectSpecialization: (editStaffData.subjectSpecialization || '').trim(),
        gradesClassesHandled: (editStaffData.gradesClassesHandled || '').trim(),
        professionalCertifications: (editStaffData.professionalCertifications || '').trim(),
        roles:            editStaffData.roles || (editStaffData.role ? [editStaffData.role] : ['Staffs']),
        role:             (editStaffData.roles && editStaffData.roles.length > 0) ? editStaffData.roles[0] : (editStaffData.role || 'Staffs'),
        staff_type:       editStaffData.staff_type || 'teaching',
        status:           editStaffData.status || 'Active',
        // Sensitive — only updated if present
        govtIdType:       (editStaffData.govtIdType || '').trim(),
        govtIdNumber:     (editStaffData.govtIdNumber || '').trim(),
        panNumber:        (editStaffData.panNumber || '').trim(),
        pfNumber:         (editStaffData.pfNumber || '').trim(),
        esicNumber:       (editStaffData.esicNumber || '').trim(),
        uanNumber:        (editStaffData.uanNumber || '').trim(),
        taxIdDetails:     (editStaffData.taxIdDetails || '').trim(),
        bankName:         (editStaffData.bankName || '').trim(),
        bankAccountNumber:(editStaffData.bankAccountNumber || '').trim(),
        branchName:       (editStaffData.branchName || '').trim(),
        ifscCode:         (editStaffData.ifscCode || '').trim(),
        lastUpdatedBy:    userProfile?.name || userProfile?.email || 'Admin',
        lastUpdatedAt:    new Date().toISOString(),
        customData:       uploadedCustomData || {},
      };

      await updateSubDocument(schoolId, 'teachers', selectedStaffToView.id, updateData);
      const updated = { ...selectedStaffToView, ...updateData };
      setSelectedStaffToView(updated);
      setIsStaffEditMode(false);
      setEditStaffDocFiles({});
      toast.success('Staff details updated successfully.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save changes.');
    } finally {
      setSavingStaffEdit(false);
    }
  };

  const checkStaffUniqueness = (staffIdVal, emailVal, currentId = null) => {
    const isIdDuplicate = staff.some(
      s => s.id !== currentId && s.staffId && s.staffId.trim().toLowerCase() === staffIdVal.trim().toLowerCase()
    );
    const isEmailDuplicate = staff.some(
      s => s.id !== currentId && s.email && s.email.trim().toLowerCase() === emailVal.trim().toLowerCase()
    );
    return { isIdDuplicate, isEmailDuplicate };
  };

  const validateStaffForm = (isRegisterPage = false) => {
    const errors = {};
    if (!newStaff.staffId?.trim()) errors.staffId = "Staff ID is required";
    if (!newStaff.firstName?.trim()) errors.firstName = "First name is required";
    if (!newStaff.roleId) errors.roleId = "Role selection is mandatory";
    if (!newStaff.email?.trim()) {
      errors.email = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newStaff.email)) errors.email = "Invalid email format";
    }
    
    // Check duplicates
    if (newStaff.staffId && newStaff.email) {
      const { isIdDuplicate, isEmailDuplicate } = checkStaffUniqueness(newStaff.staffId, newStaff.email);
      if (isIdDuplicate) errors.staffId = "Staff ID must be unique";
      if (isEmailDuplicate) errors.email = "Email must be unique";
    }

    if (newStaff.mobileNumber && !/^\d{10}$/.test(newStaff.mobileNumber)) {
      errors.mobileNumber = "Mobile number must be a 10-digit number";
    }
    if (newStaff.emergencyContact && !/^\d{10}$/.test(newStaff.emergencyContact)) {
      errors.emergencyContact = "Emergency contact must be a 10-digit number";
    }
    if (newStaff.aadharNumber && !/^\d{12}$/.test(newStaff.aadharNumber)) {
      errors.aadharNumber = "Aadhaar number must be a 12-digit number";
    }
    if (newStaff.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(newStaff.panNumber.toUpperCase())) {
      errors.panNumber = "Invalid PAN format (e.g. ABCDE1234F)";
    }
    if (newStaff.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(newStaff.ifscCode.toUpperCase())) {
      errors.ifscCode = "Invalid IFSC Code format (e.g. SBIN0001234)";
    }
    if (newStaff.yearOfPassing) {
      const currentYear = new Date().getFullYear();
      if (Number(newStaff.yearOfPassing) > currentYear) {
        errors.yearOfPassing = "Year of passing cannot be in the future";
      }
    }
    if (newStaff.previousExperience && Number(newStaff.previousExperience) < 0) {
      errors.previousExperience = "Previous experience cannot be negative";
    }
    if (newStaff.bankAccountNumber && !/^\d+$/.test(newStaff.bankAccountNumber)) {
      errors.bankAccountNumber = "Bank account number must contain only digits";
    }

    if (isRegisterPage) {
      if (!newStaff.username?.trim()) errors.username = "Username is required";
    }

    setAddStaffErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const uploadStaffFile = async (file, path) => {
    return await uploadFileToCloudinaryOrFirebase(file, schoolId, path);
  };

  const uploadAllDocuments = async (staffIdOrEmail) => {
    const urls = {};
    const baseFolder = `schools/${schoolId}/teachers/${staffIdOrEmail}`;
    
    // Photo
    if (addStaffFiles.photo) {
      urls.photoUrl = await uploadStaffFile(addStaffFiles.photo, `${baseFolder}/photo_${addStaffFiles.photo.name}`);
    }

    const docKeys = [
      'academicCertificates', 'markSheets', 'experienceCertificates', 
      'relievingLetter', 'resume', 'referenceLetters', 'govtIdDocument', 'salarySlips'
    ];

    for (const key of docKeys) {
      const files = addStaffFiles[key] || [];
      if (files.length > 0) {
        const uploadedUrls = [];
        for (const f of files) {
          const url = await uploadStaffFile(f, `${baseFolder}/${key}/${f.name}`);
          uploadedUrls.push({ name: f.name, url });
        }
        urls[key] = uploadedUrls;
      }
    }
    return urls;
  };

  const logStaffAudit = async (staffId, staffName, actionPerformed, modifiedFields = []) => {
    if (!schoolId) return;
    try {
      await addSubDocument(schoolId, 'staff_audit_logs', {
        staffId,
        staffName,
        userName: userProfile?.name || userProfile?.email || 'Unknown User',
        userRole: userProfile?.role || 'Staff',
        timestamp: new Date().toISOString(),
        actionPerformed,
        modifiedFields
      });
    } catch (e) {
      console.error("Failed to write staff audit log:", e);
    }
  };

  const handleAddStaff = async () => {
    // Trim spaces
    const trimmed = {};
    Object.keys(newStaff).forEach(k => {
      if (typeof newStaff[k] === 'string') {
        trimmed[k] = newStaff[k].trim();
      } else {
        trimmed[k] = newStaff[k];
      }
    });
    newStaff.staffId = trimmed.staffId;
    newStaff.firstName = trimmed.firstName;
    newStaff.lastName = trimmed.lastName;
    newStaff.email = trimmed.email;
    newStaff.mobileNumber = trimmed.mobileNumber;
    newStaff.aadharNumber = trimmed.aadharNumber;
    newStaff.panNumber = trimmed.panNumber;
    newStaff.ifscCode = trimmed.ifscCode;
    newStaff.bankAccountNumber = trimmed.bankAccountNumber;

    if (!validateStaffForm(false)) {
      toast.error("Please resolve the validation errors first.");
      return;
    }

    setAddingStaff(true);
    const progressToastId = toast.loading("Uploading documents & saving staff member...");
    try {
      // 1. Upload files
      const uploadedUrls = await uploadAllDocuments(newStaff.staffId);
      const uploadedCustomData = await uploadCustomDataFiles(newStaff.customData, schoolId, 'staff');

      // 2. Add to backend API (Postgres User with roleId validated against collegeId)
      let backendStaffUser = null;
      try {
        const apiRes = await api.post('/staff', {
          name: `${newStaff.firstName} ${newStaff.lastName || ''}`.trim(),
          email: newStaff.email,
          phone: newStaff.mobileNumber || undefined,
          employeeId: newStaff.staffId || undefined,
          roleId: newStaff.roleId
        });
        backendStaffUser = apiRes?.staff;
      } catch (apiError) {
        toast.dismiss(progressToastId);
        toast.error(apiError.message || "Failed to create staff user in database");
        setAddingStaff(false);
        return;
      }

      // 3. Add to Firestore for local UI realtime synchronization
      const staffDoc = {
        ...newStaff,
        userId: backendStaffUser?.id || undefined,
        status: 'Invited',
        roleId: newStaff.roleId,
        ...uploadedUrls,
        customData: uploadedCustomData || {},
        name: `${newStaff.firstName} ${newStaff.lastName || ''}`.trim(),
        employeeId: newStaff.staffId,
        createdAt: new Date().toISOString(),
        roles: newStaff.roles && newStaff.roles.length > 0 ? newStaff.roles : (newStaff.role ? [newStaff.role] : []),
        role: newStaff.role || (newStaff.roles && newStaff.roles[0]) || ''
      };

      await addSubDocument(schoolId, 'teachers', staffDoc);

      // 3. Log audit event
      await logStaffAudit(newStaff.staffId, `${newStaff.firstName} ${newStaff.lastName}`, "Created", [
        { field: 'firstName', newValue: newStaff.firstName },
        { field: 'lastName', newValue: newStaff.lastName },
        { field: 'email', newValue: newStaff.email },
        { field: 'staffId', newValue: newStaff.staffId }
      ]);

      toast.success("Staff member added successfully!", { id: progressToastId });
      setAddStaffModalOpen(false);

      // Refresh backend staff map and open invite link modal for newly added staff
      loadBackendStaff();
      if (backendStaffUser?.id) {
        openInviteModal({
          userId: backendStaffUser.id,
          name: `${newStaff.firstName} ${newStaff.lastName || ''}`.trim(),
          email: newStaff.email,
          staffId: newStaff.staffId
        });
      }
      setNewStaff(initialStaffFormState);
      setAddStaffFiles({
        photo: null,
        academicCertificates: [],
        markSheets: [],
        experienceCertificates: [],
        relievingLetter: [],
        resume: [],
        referenceLetters: [],
        govtIdDocument: [],
        salarySlips: []
      });
      setAddStaffErrors({});
      setAddStaffActiveTab('Personal');
    } catch (error) {
      console.error("Error adding staff:", error);
      toast.error(error.message || "Failed to add staff member.", { id: progressToastId });
    } finally {
      setAddingStaff(false);
    }
  };

  const getClassName = (classId) => {
    if (!classId) return 'Unassigned';
    const cls = classes.find(c => c.id === classId);
    return cls ? `${cls.name} - ${cls.section}` : 'Unknown Class';
  };

  const exportToExcel = () => {
    if (staff.length === 0) {
      toast.error("No staff data available to export.");
      return;
    }

    const activeFields = Object.keys(selectedFields).filter(k => selectedFields[k]);
    if (activeFields.length === 0) {
      toast.error("Please select at least one column to export.");
      return;
    }

    const exportData = staff.map((member, index) => {
      const row = { "S.No": index + 1 };
      if (selectedFields.name) row["Name"] = member.name || `${member.firstName} ${member.lastName}`.trim();
      if (selectedFields.email) row["Email"] = member.email || '';
      if (selectedFields.role) {
        row["Role"] = getStaffRoleName(member);
      }
      if (selectedFields.assignedClass) row["Assigned Class"] = getClassName(member.assignedClassId);
      if (selectedFields.subjectClasses) row["Subject Classes"] = (member.subjectClassIds || []).map(getClassName).join(', ');
      if (selectedFields.mobile) row["Mobile"] = member.mobileNumber || '';
      if (selectedFields.qualification) row["Highest Qualification"] = member.highestQualification || '';
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Staff");

    const rawName = exportFileName.trim() || "Staff_Directory";
    const finalFileName = rawName.toLowerCase().endsWith('.xlsx') ? rawName : `${rawName}.xlsx`;

    XLSX.writeFile(workbook, finalFileName);
    setShowExportModal(false);
    toast.success("Staff directory exported successfully!");
  };

  const filteredStaff = staff.filter(member => {
    const name = member.name || `${member.firstName} ${member.lastName}`;
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           (member.email && member.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const staffRole = getStaffRoleName(member);
    const matchesRole = roleFilter === 'all' || 
                         staffRole.toLowerCase() === roleFilter.toLowerCase() || 
                         (member.roles && member.roles.some(r => r.toLowerCase() === roleFilter.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || (member.status || 'Active') === statusFilter;
    const matchesGender = genderFilter === 'all' || normalizeGender(member.gender, '') === genderFilter;
    
    if (!(matchesSearch && matchesRole && matchesStatus && matchesGender)) return false;

    if (staffTypeFilter === 'teaching') {
      return member.staff_type === 'teaching';
    } else if (staffTypeFilter === 'non-teaching') {
      return member.staff_type === 'non-teaching' || !member.staff_type;
    }
    return true;
  });

  // Metrics
  const totalStaff = staff.length;
  const activeStaff = staff.filter(s => (s.status || 'Active') === 'Active').length;
  const maleStaff = staff.filter(s => isMale(s.gender)).length;
  const femaleStaff = staff.filter(s => isFemale(s.gender)).length;
  const teachingRoles = ['Correspondent', 'Principal', 'Vice Principal', 'Subject Wise Head', 'Class Incharge', 'Staffs'];
  const teachingStaff = staff.filter(s => {
    const rolesList = s.roles || [s.role || 'Staffs'];
    return rolesList.some(r => teachingRoles.includes(r));
  }).length;
  const nonTeachingStaff = totalStaff - teachingStaff;

  // Pagination Logic
  const totalPages = Math.ceil(filteredStaff.length / rowsPerPage) || 1;
  const paginatedStaff = filteredStaff.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, staffTypeFilter, genderFilter, rowsPerPage]);

  if (loading) {
    return (
      <div className="w-full animate-fade-in-up">
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  return (
    <div className="w-full pb-16">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Staff Directory & Attachments</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your teachers, upload documents, and assign classes.</p>
        </div>
        <div className="flex flex-wrap gap-3 mt-4 sm:mt-0">
          <button 
            onClick={() => {
              if (staff.length === 0) {
                toast.error("No staff data available to export.");
                return;
              }
              setExportFileName('Staff_Directory');
              setShowExportModal(true);
            }}
            className="px-4 py-2 bg-primary-50 text-primary-700 rounded-xl font-medium hover:bg-primary-100 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 transition-colors border border-primary-200"
          >
            <FileDown size={18} /> Export
          </button>
          {hasCreatePermission && (
            <button 
              onClick={() => {
                fetchRoles();
                setAddStaffActiveTab('Personal');
                setAddStaffModalOpen(true);
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 shadow-sm flex items-center gap-2 transition-colors"
            >
              <UserPlus size={18} /> Add Staff
            </button>
          )}
          {hasCreatePermission && (
            <button 
              onClick={() => {
                setUploadFile(null);
                setSelectedStaffForUpload(null);
                setUploadModalOpen(true);
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 shadow-sm flex items-center gap-2 transition-colors"
            >
              <UploadCloud size={18} /> Bulk Import
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-fade-in-up">
        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Staff</p><p className="text-xl font-bold text-slate-900 dark:text-white">{totalStaff}</p></div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active</p><p className="text-xl font-bold text-slate-900 dark:text-white">{activeStaff}</p></div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><UserPlus size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Male Staff</p><p className="text-xl font-bold text-slate-900 dark:text-white">{maleStaff}</p></div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-pink-50 text-pink-600 rounded-xl"><UserPlus size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Female Staff</p><p className="text-xl font-bold text-slate-900 dark:text-white">{femaleStaff}</p></div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><UserPlus size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Teachers</p><p className="text-xl font-bold text-slate-900 dark:text-white">{teachingStaff}</p></div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><UserPlus size={20} /></div>
            <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Non-Teaching</p><p className="text-xl font-bold text-slate-900 dark:text-white">{nonTeachingStaff}</p></div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-slate-900">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Search staff by name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Roles</option>
              {rolesList.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select 
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            {/* Filter by Staff Type — inline in filter bar */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={`px-3 py-2.5 rounded-xl border shadow-sm transition-all flex items-center gap-2 text-sm font-medium relative
                  ${staffTypeFilter !== 'all'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                title="Filter Staff by Type"
              >
                <Filter size={16} />
                <span>{staffTypeFilter === 'all' ? 'Staff Type' : staffTypeFilter === 'teaching' ? 'Teaching' : 'Non-Teaching'}</span>
                {staffTypeFilter !== 'all' && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white" />
                )}
              </button>

              {isFilterDropdownOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-100 dark:border-slate-800 p-2 z-50 animate-fade-in-up">
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => { setStaffTypeFilter('all'); setIsFilterDropdownOpen(false); }}
                      className={`w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors flex items-center justify-between ${
                        staffTypeFilter === 'all' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>All Staff</span>
                      {staffTypeFilter === 'all' && <CheckCircle2 size={16} className="text-indigo-600" />}
                    </button>
                    <button
                      onClick={() => { setStaffTypeFilter('teaching'); setIsFilterDropdownOpen(false); }}
                      className={`w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors flex items-center justify-between ${
                        staffTypeFilter === 'teaching' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>Teaching Staff</span>
                      {staffTypeFilter === 'teaching' && <CheckCircle2 size={16} className="text-indigo-600" />}
                    </button>
                    <button
                      onClick={() => { setStaffTypeFilter('non-teaching'); setIsFilterDropdownOpen(false); }}
                      className={`w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors flex items-center justify-between ${
                        staffTypeFilter === 'non-teaching' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>Non-Teaching Staff</span>
                      {staffTypeFilter === 'non-teaching' && <CheckCircle2 size={16} className="text-indigo-600" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1"></div>
            <select 
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4 pl-6">Staff Name</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Status</th>
                <th className="p-4">Class Assignments</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-500 dark:text-slate-400">
                    <ShieldCheck size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No staff members found</p>
                    <p>Generate a teacher invite link to start onboarding your faculty.</p>
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((member) => {
                  const name = member.name || `${member.firstName} ${member.lastName}`;
                  const isAssigned = !!member.assignedClassId;
                  const backendUser = (member.userId && backendStaffMap[member.userId]) || (member.email && backendStaffMap[member.email?.toLowerCase()]) || (member.staffId && backendStaffMap[member.staffId]);
                  const hasRegisteredPassword = backendUser?.hasPassword ?? (backendUser?.password ? true : false);
                  const isInvitedOrUnregistered = !hasRegisteredPassword || (backendUser?.status || member.status || 'INVITED').toUpperCase() === 'INVITED';
                  const staffStatus = isInvitedOrUnregistered ? 'INVITED' : (backendUser?.status || member.status || 'ACTIVE').toUpperCase();

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                            {name.charAt(0)}
                          </div>
                          <div className="font-semibold text-slate-900 dark:text-white leading-snug">
                            {name}
                            <div className="text-xs font-medium text-orange-600 dark:text-orange-400">
                              {getStaffRoleName(member)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <Mail size={14} className="text-slate-400 dark:text-slate-300" />
                          {member.email}
                        </div>
                      </td>
                      <td className="p-4">
                        {staffStatus === 'INVITED' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Invited
                          </span>
                        ) : staffStatus === 'INACTIVE' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                          {isAssigned && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-primary-200/60 bg-primary-50/50 text-primary-700 text-[11px] font-semibold uppercase tracking-wide">
                              {getClassName(member.assignedClassId)} (Class)
                            </span>
                          )}
                          {member.subjectClassIds?.map(id => (
                            <span key={id} className="inline-flex items-center px-2.5 py-0.5 rounded border border-indigo-200/60 bg-indigo-50/50 text-indigo-700 text-[11px] font-semibold uppercase tracking-wide">
                              {getClassName(id)} (Subj)
                            </span>
                          ))}
                          {!isAssigned && (!member.subjectClassIds || member.subjectClassIds.length === 0) && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-slate-200/60 bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wide">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          {isInvitedOrUnregistered ? (
                            <button
                              onClick={() => openInviteModal(member)}
                              className="px-2.5 py-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800/60 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                              title="Staff Password Not Registered - Click to View/Copy Registration Link"
                            >
                              <LinkIcon size={15} className="text-orange-600 dark:text-orange-400 shrink-0" />
                              <span className="hidden sm:inline">Invite Link</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => openInviteModal(member)}
                              className="p-2 text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Staff Already Registered - Click to Re-share / Regenerate Link"
                            >
                              <LinkIcon size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedStaffToView(member);
                              setAddStaffActiveTab('Personal Info');
                              setIsStaffEditMode(false);
                              setEditStaffData(null);
                              setEditStaffErrors({});
                              setEditStaffDocFiles({});
                              setViewStaffModalOpen(true);
                            }}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                            {hasDeletePermission && (
                              <button 
                                onClick={() => setConfirmDeleteState({ isOpen: true, id: member.id, name: member.name || `${member.firstName} ${member.lastName}` })}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Delete Staff Member"
                              >
                                <Trash size={18} />
                              </button>
                            )}
                            {hasEditPermission && (
                              <button 
                                onClick={() => openAssignModal(member)}
                                className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md transition-colors"
                              >
                                {isAssigned ? 'Edit' : 'Assign'}
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-b-3xl">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredStaff.length)} of {filteredStaff.length} entries
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                Page {currentPage} of {totalPages}
              </div>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {assignModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Assign Class</h2>
              <button onClick={() => setAssignModalOpen(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                Manage assignments for <span className="font-bold text-slate-900 dark:text-white">{selectedStaff.name || selectedStaff.firstName}</span>.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Class Teacher Assignment (Optional)</label>
                  <select 
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  >
                    <option value="">-- None --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Subject Teacher Assignments</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                    {classes.map(c => (
                      <label key={`subj-${c.id}`} className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedSubjectClassIds.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubjectClassIds([...selectedSubjectClassIds, c.id]);
                            } else {
                              setSelectedSubjectClassIds(selectedSubjectClassIds.filter(id => id !== c.id));
                            }
                          }}
                          className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{c.name} - Section {c.section}</span>
                      </label>
                    ))}
                    {classes.length === 0 && <span className="text-sm text-slate-500 dark:text-slate-400 italic p-2">No classes available.</span>}
                  </div>
                </div>

                {classes.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    No classes have been created yet. Please create classes in Class Management first.
                  </p>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Subject Specializations</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                    {subjects.map(s => (
                      <label key={`spec-${s.id}`} className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedSubjectIds.includes(s.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubjectIds([...selectedSubjectIds, s.id]);
                            } else {
                              setSelectedSubjectIds(selectedSubjectIds.filter(id => id !== s.id));
                            }
                          }}
                          className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.name} {s.code ? `(${s.code})` : ''}</span>
                      </label>
                    ))}
                    {subjects.length === 0 && <span className="text-sm text-slate-500 dark:text-slate-400 italic p-2">No subjects available.</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setAssignModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAssign}
                disabled={saving || classes.length === 0}
                className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl shadow-sm disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document / Bulk Import Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-primary-600" />
                {selectedStaffForUpload ? 'Upload Document' : 'Bulk Import Staff'}
              </h2>
              <button onClick={() => setUploadModalOpen(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              {selectedStaffForUpload ? (
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  Upload a document (e.g. Resume, ID) for <span className="font-bold text-slate-900 dark:text-white">{selectedStaffForUpload.name || selectedStaffForUpload.firstName}</span>. 
                  <br/><span className="text-xs text-slate-400 dark:text-slate-300 mt-1 block">File will be securely stored in: {schoolName}/Teachers/...</span>
                </p>
              ) : (
                <div className="mb-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    Upload an Excel (.xlsx) or CSV file to bulk import staff.
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-3 text-xs">
                    <p className="font-bold text-slate-700 dark:text-slate-200 mb-1">Required Columns:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Full Name', 'Email Address'].map(col => (
                        <span key={col} className="bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-md">{col} *</span>
                      ))}
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-2 mb-1">Optional (all other columns supported):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Staff ID', 'Mobile Number', 'Gender', 'Date of Birth', 'Blood Group', 'Role', 'Staff Type', 'Aadhar Number', 'PAN Number', 'PF Number', 'Bank Account Number'].map(col => (
                        <span key={col} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium px-2 py-0.5 rounded-md">{col}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const headers = ['Staff ID', 'Full Name', 'Date of Birth', 'Gender', 'Nationality', 'Marital Status', 'Blood Group', 'Aadhar Number', 'Languages Known', 'Mobile Number', 'Email Address', 'Residential Address', 'Emergency Contact Details', 'Father Name/Guardian Name', 'Highest Qualification', 'Degree(s) and Specialization', 'University/College Name', 'Year of Passing', 'Previous Experience (Years)', 'Previous School/Organization', 'Subject Specialization', 'Grades/Classes Handled', 'Certifications', 'Government-issued ID', 'Tax Identification Details (PAN)', 'PF Number', 'ESIC Number', 'UAN Number', 'Bank Account Number', 'Bank Name and Branch', 'IFSC Code', 'PAN Number'];
                      const sampleRow = ['STF001', 'John Doe', '1990-01-15', 'Male', 'Indian', 'Single', 'A+', '1234-5678-9012', 'English, Hindi', '9876543210', 'john.doe@school.com', '123 Main St, City', 'Jane Doe - 9876500000', 'Robert Doe', 'M.Sc Education', 'B.Ed, Mathematics', 'Delhi University', '2015', '5', 'ABC School', 'Mathematics', '9, 10, 11', 'B.Ed', 'Aadhaar', 'ABCDE1234F', 'PF123456', 'ESIC789', 'UAN456', '123456789012', 'State Bank, Main Branch', 'SBIN0001234', 'ABCDE1234F'];
                      const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, 'Staff Import');
                      XLSX.writeFile(wb, 'staff_import_template.xlsx');
                    }}
                    className="flex items-center gap-2 text-xs font-semibold text-primary-600 hover:text-primary-800 hover:underline"
                  >
                    <Download size={14} /> Download Full Template (32 columns)
                  </button>
                </div>
              )}

              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 bg-slate-50 dark:bg-slate-800 relative overflow-hidden group hover:border-primary-400 dark:hover:border-slate-700 hover:bg-primary-50 dark:hover:bg-slate-800 transition-all text-center">
                <input 
                  type="file" 
                  accept={selectedStaffForUpload ? "image/*, .pdf" : ".xlsx, .csv"}
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                />
                <UploadCloud size={32} className={`mx-auto mb-3 ${uploadFile ? 'text-green-500' : 'text-slate-400 dark:text-slate-300 group-hover:text-primary-500'}`} />
                {uploadFile ? (
                  <div>
                    <p className="font-semibold text-green-700 text-sm truncate">{uploadFile.name}</p>
                    <p className="text-xs text-green-600 mt-1">Ready to upload</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Click or drag file to upload</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedStaffForUpload ? 'PDF, JPG, PNG up to 10MB' : 'Excel or CSV file'}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setUploadModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpload}
                disabled={uploading || !uploadFile}
                className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {addStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 sm:px-8 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/50 border border-primary-100 dark:border-primary-800/60 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0 shadow-sm">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Add Staff Member
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Enter staff information to create a new staff profile.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddStaffModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors duration-150"
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Custom CSS to hide scrollbars cleanly */}
            <style dangerouslySetInnerHTML={{__html: `
              .hide-scrollbar::-webkit-scrollbar {
                display: none;
              }
              .hide-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}} />

            {/* Tabbed Navigation */}
            <div className="flex border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-4 sm:px-6 shrink-0 overflow-x-auto hide-scrollbar scroll-smooth">
              <div className="flex items-center gap-1.5 py-2.5 min-w-max">
                {STAFF_TABS.map(tab => {
                  const isActive = addStaffActiveTab === tab.id;
                  const TabIcon = tab.icon;
                  const tabErrorCount = TAB_ERROR_FIELDS[tab.id]?.filter(f => !!addStaffErrors[f]).length || 0;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      ref={isActive ? activeTabRef : null}
                      onClick={() => setAddStaffActiveTab(tab.id)}
                      aria-selected={isActive}
                      role="tab"
                      className={`relative px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-2 select-none ${
                        isActive
                          ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm border border-primary-200/80 dark:border-primary-900/60 font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <TabIcon size={14} className={isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'} />
                      <span>{tab.label}</span>
                      {tabErrorCount > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title={`${tabErrorCount} error(s)`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="p-6 sm:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              {/* Tab Content: Personal */}
              {addStaffActiveTab === 'Personal' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Section 1: Basic Identity */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Basic Identity
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Staff ID <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          type="text"
                          value={newStaff.staffId}
                          onChange={(e) => setNewStaff({ ...newStaff, staffId: e.target.value })}
                          placeholder="e.g. ST1001"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                            addStaffErrors.staffId
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                              : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                          }`}
                        />
                        {addStaffErrors.staffId && (
                          <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                            <CircleAlert size={12} className="shrink-0" />
                            <span>{addStaffErrors.staffId}</span>
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          First Name <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          type="text"
                          value={newStaff.firstName}
                          onChange={(e) => setNewStaff({ ...newStaff, firstName: e.target.value })}
                          placeholder="e.g. John"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                            addStaffErrors.firstName
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                              : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                          }`}
                        />
                        {addStaffErrors.firstName && (
                          <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                            <CircleAlert size={12} className="shrink-0" />
                            <span>{addStaffErrors.firstName}</span>
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Last Name <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          type="text"
                          value={newStaff.lastName}
                          onChange={(e) => setNewStaff({ ...newStaff, lastName: e.target.value })}
                          placeholder="e.g. Doe"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                            addStaffErrors.lastName
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                              : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                          }`}
                        />
                        {addStaffErrors.lastName && (
                          <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                            <CircleAlert size={12} className="shrink-0" />
                            <span>{addStaffErrors.lastName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Contact Information */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Contact Information
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Email Address <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          type="email"
                          value={newStaff.email}
                          onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                          placeholder="john.doe@example.com"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                            addStaffErrors.email
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                              : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                          }`}
                        />
                        {addStaffErrors.email && (
                          <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                            <CircleAlert size={12} className="shrink-0" />
                            <span>{addStaffErrors.email}</span>
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Mobile Number
                        </label>
                        <input
                          type="text"
                          value={newStaff.mobileNumber}
                          onChange={(e) => setNewStaff({ ...newStaff, mobileNumber: e.target.value })}
                          placeholder="e.g. 9876543210"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                            addStaffErrors.mobileNumber
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                              : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                          }`}
                        />
                        {addStaffErrors.mobileNumber && (
                          <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                            <CircleAlert size={12} className="shrink-0" />
                            <span>{addStaffErrors.mobileNumber}</span>
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Emergency Contact Details
                        </label>
                        <input
                          type="text"
                          value={newStaff.emergencyContact}
                          onChange={(e) => setNewStaff({ ...newStaff, emergencyContact: e.target.value })}
                          placeholder="Emergency Mobile No."
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                            addStaffErrors.emergencyContact
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                              : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                          }`}
                        />
                        {addStaffErrors.emergencyContact && (
                          <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                            <CircleAlert size={12} className="shrink-0" />
                            <span>{addStaffErrors.emergencyContact}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Personal & Demographic Details */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Personal & Demographic Details
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={newStaff.dob}
                          onChange={(e) => setNewStaff({ ...newStaff, dob: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Gender
                        </label>
                        <select
                          value={normalizeGender(newStaff.gender, 'Male')}
                          onChange={(e) => setNewStaff({ ...newStaff, gender: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all cursor-pointer"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Blood Group
                        </label>
                        <input
                          type="text"
                          value={newStaff.bloodGroup}
                          onChange={(e) => setNewStaff({ ...newStaff, bloodGroup: e.target.value })}
                          placeholder="e.g. O+, A-"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Nationality
                        </label>
                        <input
                          type="text"
                          value={newStaff.nationality}
                          onChange={(e) => setNewStaff({ ...newStaff, nationality: e.target.value })}
                          placeholder="e.g. Indian"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Marital Status
                        </label>
                        <select
                          value={newStaff.maritalStatus}
                          onChange={(e) => setNewStaff({ ...newStaff, maritalStatus: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all cursor-pointer"
                        >
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Father / Guardian Name
                        </label>
                        <input
                          type="text"
                          value={newStaff.fatherGuardianName}
                          onChange={(e) => setNewStaff({ ...newStaff, fatherGuardianName: e.target.value })}
                          placeholder="Father or Guardian Name"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Languages Known
                        </label>
                        <input
                          type="text"
                          value={newStaff.languagesKnown}
                          onChange={(e) => setNewStaff({ ...newStaff, languagesKnown: e.target.value })}
                          placeholder="e.g. English, Hindi, Tamil"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Residential Address
                        </label>
                        <textarea
                          rows={2}
                          value={newStaff.residentialAddress}
                          onChange={(e) => setNewStaff({ ...newStaff, residentialAddress: e.target.value })}
                          placeholder="Full Residential Address"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Role & Work Assignment */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Role & Work Assignment
                      </h3>
                    </div>

                    {rolesList.length === 0 ? (
                      <div className="p-4 sm:p-5 rounded-2xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
                        <div className="flex items-start gap-3.5">
                          <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 mt-0.5">
                            <ShieldCheck size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              No roles have been created for your school yet.
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                              A new school starts with zero roles. You must create at least one role with module permissions before adding staff members.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAddStaffModalOpen(false);
                            navigate('/admin/roles');
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0 active:scale-95"
                        >
                          <ShieldCheck size={15} />
                          <span>Go to Roles & Permissions</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Assigned Role <span className="text-rose-500 font-bold">*</span>
                          </label>
                          <select
                            value={newStaff.roleId || ''}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const selectedRole = rolesList.find(r => r.id === selectedId);
                              setNewStaff({
                                ...newStaff,
                                roleId: selectedId,
                                role: selectedRole ? selectedRole.name : '',
                                roles: selectedRole ? [selectedRole.name] : []
                              });
                              if (addStaffErrors.roleId) {
                                setAddStaffErrors(prev => ({ ...prev, roleId: undefined }));
                              }
                            }}
                            className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                              addStaffErrors.roleId
                                ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                                : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                            }`}
                          >
                            <option value="">-- Choose a Role --</option>
                            {rolesList.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          {addStaffErrors.roleId && (
                            <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                              <CircleAlert size={12} className="shrink-0" />
                              <span>{addStaffErrors.roleId}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Staff Type <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <select
                          value={newStaff.staff_type}
                          onChange={(e) => setNewStaff({ ...newStaff, staff_type: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all cursor-pointer"
                        >
                          <option value="teaching">Teaching Staff</option>
                          <option value="non-teaching">Non-Teaching Staff</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Assign Class (Optional)
                        </label>
                        <select
                          value={newStaff.assignedClassId}
                          onChange={(e) => setNewStaff({ ...newStaff, assignedClassId: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all cursor-pointer"
                        >
                          <option value="">-- Unassigned --</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 5: Additional Custom Fields */}
                  <div className="space-y-3.5 pt-2">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Additional Custom Fields
                      </h3>
                    </div>
                    <CustomFieldsRenderer
                      moduleKey="staff"
                      customData={newStaff.customData}
                      onChange={(k, v) => setNewStaff(prev => ({...prev, customData: {...(prev.customData || {}), [k]: v}}))}
                    />
                  </div>
                </div>
              )}

              {/* Tab Content: Educational */}
              {addStaffActiveTab === 'Educational' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Academic Credentials & Qualifications
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Highest Qualification
                      </label>
                      <input
                        type="text"
                        value={newStaff.highestQualification}
                        onChange={(e) => setNewStaff({ ...newStaff, highestQualification: e.target.value })}
                        placeholder="e.g. Master of Arts"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Degree(s) & Specialization
                      </label>
                      <input
                        type="text"
                        value={newStaff.degreeSpecialization}
                        onChange={(e) => setNewStaff({ ...newStaff, degreeSpecialization: e.target.value })}
                        placeholder="e.g. B.Ed in English Literature"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        University / College Name
                      </label>
                      <input
                        type="text"
                        value={newStaff.universityName}
                        onChange={(e) => setNewStaff({ ...newStaff, universityName: e.target.value })}
                        placeholder="e.g. University of Delhi"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Year of Passing
                      </label>
                      <input
                        type="number"
                        value={newStaff.yearOfPassing}
                        onChange={(e) => setNewStaff({ ...newStaff, yearOfPassing: e.target.value })}
                        placeholder="e.g. 2018"
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                          addStaffErrors.yearOfPassing
                            ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                        }`}
                      />
                      {addStaffErrors.yearOfPassing && (
                        <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                          <CircleAlert size={12} className="shrink-0" />
                          <span>{addStaffErrors.yearOfPassing}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Professional */}
              {addStaffActiveTab === 'Professional' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Professional Background & Experience
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Previous Experience (Years)
                      </label>
                      <input
                        type="number"
                        value={newStaff.previousExperience}
                        onChange={(e) => setNewStaff({ ...newStaff, previousExperience: e.target.value })}
                        placeholder="e.g. 3"
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                          addStaffErrors.previousExperience
                            ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                        }`}
                      />
                      {addStaffErrors.previousExperience && (
                        <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                          <CircleAlert size={12} className="shrink-0" />
                          <span>{addStaffErrors.previousExperience}</span>
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Previous School / Organization
                      </label>
                      <input
                        type="text"
                        value={newStaff.previousOrganization}
                        onChange={(e) => setNewStaff({ ...newStaff, previousOrganization: e.target.value })}
                        placeholder="Previous School Name"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Subject Specialization
                      </label>
                      <input
                        type="text"
                        value={newStaff.subjectSpecialization}
                        onChange={(e) => setNewStaff({ ...newStaff, subjectSpecialization: e.target.value })}
                        placeholder="e.g. English Literature, Physics"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Grades / Classes Handled
                      </label>
                      <input
                        type="text"
                        value={newStaff.gradesClassesHandled}
                        onChange={(e) => setNewStaff({ ...newStaff, gradesClassesHandled: e.target.value })}
                        placeholder="e.g. Class 9, Class 10 (comma separated)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Professional Certifications
                      </label>
                      <input
                        type="text"
                        value={newStaff.professionalCertifications}
                        onChange={(e) => setNewStaff({ ...newStaff, professionalCertifications: e.target.value })}
                        placeholder="e.g. TEFL, CBSE In-Service Training"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Government & Identity */}
              {addStaffActiveTab === 'Government & Identity' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Statutory Identification & Verification
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Government-Issued ID Type
                      </label>
                      <select
                        value={newStaff.govtIdType}
                        onChange={(e) => setNewStaff({ ...newStaff, govtIdType: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all cursor-pointer"
                      >
                        <option value="Aadhaar">Aadhaar Card</option>
                        <option value="PAN">PAN Card</option>
                        <option value="Passport">Passport</option>
                        <option value="VoterID">Voter ID Card</option>
                        <option value="DrivingLicense">Driving License</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Government-Issued ID Number
                      </label>
                      <input
                        type="text"
                        value={newStaff.govtIdNumber}
                        onChange={(e) => setNewStaff({ ...newStaff, govtIdNumber: e.target.value })}
                        placeholder="ID Document Number"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Aadhaar Number (12 digits)
                      </label>
                      <input
                        type="text"
                        value={newStaff.aadharNumber}
                        onChange={(e) => setNewStaff({ ...newStaff, aadharNumber: e.target.value })}
                        placeholder="e.g. 123456789012"
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                          addStaffErrors.aadharNumber
                            ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                        }`}
                      />
                      {addStaffErrors.aadharNumber && (
                        <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                          <CircleAlert size={12} className="shrink-0" />
                          <span>{addStaffErrors.aadharNumber}</span>
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        PAN Number
                      </label>
                      <input
                        type="text"
                        value={newStaff.panNumber}
                        onChange={(e) => setNewStaff({ ...newStaff, panNumber: e.target.value })}
                        placeholder="e.g. ABCDE1234F"
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                          addStaffErrors.panNumber
                            ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                        }`}
                      />
                      {addStaffErrors.panNumber && (
                        <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                          <CircleAlert size={12} className="shrink-0" />
                          <span>{addStaffErrors.panNumber}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Tax Identification Details (if different)
                    </label>
                    <input
                      type="text"
                      value={newStaff.taxIdDetails}
                      onChange={(e) => setNewStaff({ ...newStaff, taxIdDetails: e.target.value })}
                      placeholder="Tax ID particulars"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Tab Content: Employment */}
              {addStaffActiveTab === 'Employment' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Statutory Benefits & Social Security Details
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        PF Number
                      </label>
                      <input
                        type="text"
                        value={newStaff.pfNumber}
                        onChange={(e) => setNewStaff({ ...newStaff, pfNumber: e.target.value })}
                        placeholder="Provident Fund Number"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        ESIC Number
                      </label>
                      <input
                        type="text"
                        value={newStaff.esicNumber}
                        onChange={(e) => setNewStaff({ ...newStaff, esicNumber: e.target.value })}
                        placeholder="ESIC Registration Number"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        UAN Number
                      </label>
                      <input
                        type="text"
                        value={newStaff.uanNumber}
                        onChange={(e) => setNewStaff({ ...newStaff, uanNumber: e.target.value })}
                        placeholder="Universal Account Number"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Banking */}
              {addStaffActiveTab === 'Banking' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Direct Deposit & Banking Information
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={newStaff.bankName}
                        onChange={(e) => setNewStaff({ ...newStaff, bankName: e.target.value })}
                        placeholder="e.g. State Bank of India"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        value={newStaff.bankAccountNumber}
                        onChange={(e) => setNewStaff({ ...newStaff, bankAccountNumber: e.target.value })}
                        placeholder="Digits only"
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                          addStaffErrors.bankAccountNumber
                            ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                        }`}
                      />
                      {addStaffErrors.bankAccountNumber && (
                        <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                          <CircleAlert size={12} className="shrink-0" />
                          <span>{addStaffErrors.bankAccountNumber}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Branch Name
                      </label>
                      <input
                        type="text"
                        value={newStaff.branchName}
                        onChange={(e) => setNewStaff({ ...newStaff, branchName: e.target.value })}
                        placeholder="e.g. Connaught Place Branch"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={newStaff.ifscCode}
                        onChange={(e) => setNewStaff({ ...newStaff, ifscCode: e.target.value })}
                        placeholder="e.g. SBIN0001234"
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                          addStaffErrors.ifscCode
                            ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-primary-600 focus:ring-primary-500/20'
                        }`}
                      />
                      {addStaffErrors.ifscCode && (
                        <span className="flex items-center gap-1 text-rose-500 text-xs font-medium mt-1">
                          <CircleAlert size={12} className="shrink-0" />
                          <span>{addStaffErrors.ifscCode}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Uploads */}
              {addStaffActiveTab === 'Uploads' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-1.5 h-4 bg-primary-600 rounded-full" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Supporting Documents & Profile Photo
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Photograph Card */}
                    <div className="border border-slate-200/90 dark:border-slate-750 rounded-2xl p-4 bg-slate-50/60 dark:bg-slate-800/40 hover:border-primary-300 dark:hover:border-primary-700 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                            Photograph
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                            JPG, PNG
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          Clear portrait photo for the staff ID and profile card.
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-primary-50 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 hover:border-primary-500 dark:hover:border-primary-400 rounded-xl cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-sm">
                          <UploadCloud size={16} className="text-primary-600 dark:text-primary-400" />
                          <span>Choose Photograph</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setAddStaffFiles(prev => ({ ...prev, photo: e.target.files[0] }))}
                            className="sr-only"
                          />
                        </label>

                        {addStaffFiles.photo && (
                          <div className="mt-2.5 flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs">
                            <span className="truncate text-slate-700 dark:text-slate-200 font-medium">
                              {addStaffFiles.photo.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAddStaffFiles(prev => ({ ...prev, photo: null }))}
                              className="text-rose-500 hover:text-rose-700 font-semibold text-xs ml-2 px-2 py-0.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Multi files upload cards */}
                    {[
                      { key: 'academicCertificates', label: 'Academic Certificates', desc: 'Degree certificates, diplomas, and official qualifications.' },
                      { key: 'markSheets', label: 'Mark Sheets', desc: 'Semester mark sheets and grade transcripts.' },
                      { key: 'experienceCertificates', label: 'Experience Certificates', desc: 'Service certificates from prior institutions.' },
                      { key: 'relievingLetter', label: 'Relieving Letter', desc: 'Formal release letter from former employer.' },
                      { key: 'resume', label: 'Resume / CV', desc: 'Comprehensive curriculum vitae or bio-data.' },
                      { key: 'referenceLetters', label: 'Reference Letters', desc: 'Recommendations and professional referrals.' },
                      { key: 'govtIdDocument', label: 'Government ID Document', desc: 'Scanned copy of Aadhaar, PAN, or Passport.' },
                      { key: 'salarySlips', label: 'Salary Slips (Optional)', desc: 'Recent pay stubs or compensation statements.' }
                    ].map(({ key, label, desc }) => (
                      <div
                        key={key}
                        className="border border-slate-200/90 dark:border-slate-750 rounded-2xl p-4 bg-slate-50/60 dark:bg-slate-800/40 hover:border-primary-300 dark:hover:border-primary-700 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                              {label}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                              PDF, Img &le; 3MB
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            {desc}
                          </p>
                        </div>

                        <div>
                          <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-primary-50 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 hover:border-primary-500 dark:hover:border-primary-400 rounded-xl cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-sm">
                            <FileUp size={16} className="text-primary-600 dark:text-primary-400" />
                            <span>Upload Document(s)</span>
                            <input
                              type="file"
                              multiple
                              accept=".pdf, image/*"
                              onChange={(e) => {
                                const selected = Array.from(e.target.files);
                                const validFiles = [];
                                selected.forEach(file => {
                                  if (file.size > 3145728 && !file.type.startsWith('audio/')) {
                                    toast.error(`File "${file.name}" exceeds the 3MB limit.`);
                                  } else {
                                    validFiles.push(file);
                                  }
                                });
                                setAddStaffFiles(prev => ({
                                  ...prev,
                                  [key]: [...(prev[key] || []), ...validFiles]
                                }));
                                e.target.value = '';
                              }}
                              className="sr-only"
                            />
                          </label>

                          {(addStaffFiles[key] || []).length > 0 && (
                            <div className="mt-2.5 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                              {(addStaffFiles[key] || []).map((file, idx) => (
                                <div
                                  key={`${key}_${idx}`}
                                  className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText size={14} className="text-primary-500 shrink-0" />
                                    <span className="truncate text-slate-700 dark:text-slate-200 font-medium">
                                      {file.name}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddStaffFiles(prev => {
                                        const list = [...prev[key]];
                                        list.splice(idx, 1);
                                        return { ...prev, [key]: list };
                                      });
                                    }}
                                    className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors ml-2 shrink-0"
                                    title="Remove Document"
                                  >
                                    <Trash size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 sm:px-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Info size={14} className="text-slate-400 shrink-0" />
                <span>Fields marked with <span className="text-rose-500 font-bold">*</span> are required</span>
              </div>
              <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setAddStaffModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition-all duration-150 active:scale-95 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddStaff}
                  disabled={addingStaff}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow shadow-primary-500/25 disabled:opacity-50 transition-all duration-150 flex items-center justify-center gap-2 active:scale-95 min-w-[160px]"
                >
                  {addingStaff ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Adding Staff...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Add Staff Member</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Staff Details Modal */}
      {viewStaffModalOpen && selectedStaffToView && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="text-indigo-600" />
                {isStaffEditMode ? 'Edit Staff Details' : 'Staff Details'}
              </h2>
              <button onClick={() => {
                if (isStaffEditMode) {
                  setIsStaffEditMode(false);
                  setEditStaffData(null);
                  setEditStaffErrors({});
                } else {
                  setViewStaffModalOpen(false);
                }
              }} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tabbed details navigation */}
            <div className="flex border-b border-slate-150 overflow-x-auto bg-slate-50/50 dark:bg-slate-800/50 shrink-0 custom-scrollbar">
              {['Personal Info', 'Education & Work', 'Identity & Banking', 'Documents'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAddStaffActiveTab(tab)}
                  className={`px-5 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                    addStaffActiveTab === tab
                      ? 'border-indigo-600 text-indigo-700 bg-white dark:bg-slate-900'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              {isStaffEditMode && editStaffData ? (
                /* ── EDIT MODE (tab-driven) ── */
                <div className="animate-fade-in">
                  {/* Personal Info Tab */}
                  {addStaffActiveTab === 'Personal Info' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          ['staffId','Staff ID'], ['firstName','First Name *'], ['lastName','Last Name'],
                          ['mobileNumber','Mobile Number'], ['email','Email Address *'], ['dob','Date of Birth'],
                          ['bloodGroup','Blood Group'], ['nationality','Nationality'], ['languagesKnown','Languages Known'],
                          ['emergencyContact','Emergency Contact'], ['fatherName','Father / Guardian Name']
                        ].map(([field, label]) => (
                          <div key={field}>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">{label}</label>
                            <input
                              type={field === 'dob' ? 'date' : field === 'email' ? 'email' : 'text'}
                              value={editStaffData[field] || ''}
                              onChange={e => setEditStaffData({...editStaffData, [field]: e.target.value})}
                              className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${editStaffErrors[field] ? 'border-red-400 bg-red-50' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}
                            />
                            {editStaffErrors[field] && <p className="text-red-500 text-xs mt-1">{editStaffErrors[field]}</p>}
                          </div>
                        ))}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">Gender</label>
                          <select value={normalizeGender(editStaffData.gender, 'Male')} onChange={e => setEditStaffData({...editStaffData, gender: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                            {['Male','Female','Other'].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">Marital Status</label>
                          <select value={editStaffData.maritalStatus || 'Single'} onChange={e => setEditStaffData({...editStaffData, maritalStatus: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                            {['Single','Married','Divorced','Widowed'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">Status</label>
                          <select value={editStaffData.status || 'Active'} onChange={e => setEditStaffData({...editStaffData, status: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option>Active</option><option>Inactive</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">Staff Type</label>
                          <select value={editStaffData.staff_type || 'teaching'} onChange={e => setEditStaffData({...editStaffData, staff_type: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="teaching">Teaching Staff</option>
                            <option value="non-teaching">Non-Teaching Staff</option>
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">Residential Address</label>
                          <textarea rows={2} value={editStaffData.residentialAddress || ''} onChange={e => setEditStaffData({...editStaffData, residentialAddress: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <CustomFieldsRenderer
                          moduleKey="staff"
                          customData={editStaffData.customData}
                          onChange={(k, v) => setEditStaffData(prev => ({...prev, customData: {...(prev.customData || {}), [k]: v}}))}
                        />
                      </div>
                    </div>
                  )}

                  {/* Education & Work Tab */}
                  {addStaffActiveTab === 'Education & Work' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          ['highestQualification','Highest Qualification'],
                          ['degreeSpecialization','Degree & Specialization'],
                          ['universityName','University / College'],
                          ['yearOfPassing','Year of Passing'],
                          ['previousExperience','Previous Experience (Years)'],
                          ['previousOrganization','Previous School / Organization'],
                          ['subjectSpecialization','Subject Specialization'],
                          ['gradesClassesHandled','Grades / Classes Handled'],
                          ['professionalCertifications','Professional Certifications']
                        ].map(([field, label]) => (
                          <div key={field}>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">{label}</label>
                            <input type="text" value={editStaffData[field] || ''} onChange={e => setEditStaffData({...editStaffData, [field]: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          </div>
                        ))}
                        <div className="col-span-1 sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">Assigned Role *</label>
                          <select
                            value={editStaffData.roleId || ''}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const selectedRole = rolesList.find(r => r.id === selectedId);
                              setEditStaffData({
                                ...editStaffData,
                                roleId: selectedId,
                                role: selectedRole ? selectedRole.name : '',
                                roles: selectedRole ? [selectedRole.name] : []
                              });
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                          >
                            <option value="">-- Choose a Role --</option>
                            {rolesList.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">Staff Type</label>
                          <select value={editStaffData.staff_type || 'teaching'} onChange={e => setEditStaffData({...editStaffData, staff_type: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="teaching">Teaching Staff</option>
                            <option value="non-teaching">Non-Teaching Staff</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Identity & Banking Tab */}
                  {addStaffActiveTab === 'Identity & Banking' && (
                    <div className="space-y-4">
                      {(userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin') ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[
                            ['govtIdType','Govt ID Type'], ['govtIdNumber','Govt ID Number'],
                            ['aadharNumber','Aadhaar Number'], ['panNumber','PAN Number'],
                            ['pfNumber','PF Number'], ['esicNumber','ESIC Number'],
                            ['uanNumber','UAN Number'], ['taxIdDetails','Tax ID Details'],
                            ['bankName','Bank Name & Branch'], ['bankAccountNumber','Account Number'],
                            ['branchName','Branch Name'], ['ifscCode','IFSC Code']
                          ].map(([field, label]) => (
                            <div key={field}>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">{label}</label>
                              <input type="text" value={editStaffData[field] || ''} onChange={e => setEditStaffData({...editStaffData, [field]: e.target.value})} className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${editStaffErrors[field] ? 'border-red-400 bg-red-50' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`} />
                              {editStaffErrors[field] && <p className="text-red-500 text-xs mt-1">{editStaffErrors[field]}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-700 text-sm font-medium flex items-center gap-2">
                          <ShieldCheck size={18} /> You don't have permission to view or edit sensitive identity & banking details.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Documents Tab — upload new + show existing */}
                  {addStaffActiveTab === 'Documents' && (
                    <div className="space-y-4 animate-fade-in">
                      {[
                        { key: 'academicCertificates', label: 'Academic Certificates' },
                        { key: 'markSheets', label: 'Mark Sheets' },
                        { key: 'experienceCertificates', label: 'Experience Certificates' },
                        { key: 'relievingLetter', label: 'Relieving Letter' },
                        { key: 'resume', label: 'Resume / CV' },
                        { key: 'referenceLetters', label: 'Reference Letters' },
                        { key: 'govtIdDocument', label: 'Government ID Document' },
                        { key: 'salarySlips', label: 'Salary Slips' }
                      ].map(({ key, label }) => {
                        const existingFiles = editStaffData[key] || selectedStaffToView[key] || [];
                        const newFiles = editStaffDocFiles[key] || [];
                        return (
                          <div key={key} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
                            <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">{label}</label>

                            {/* Existing uploaded files */}
                            {existingFiles.length > 0 && (
                              <div className="grid grid-cols-1 gap-2 mb-3">
                                {existingFiles.map((file, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewUrl(file.url)}
                                      className="flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors font-semibold text-indigo-600 text-left flex-1 min-w-0"
                                    >
                                      <Eye size={14} className="shrink-0" />
                                      <span className="truncate">{file.name}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newList = [...existingFiles];
                                        newList.splice(idx, 1);
                                        setEditStaffData(prev => ({ ...prev, [key]: newList }));
                                      }}
                                      className="text-red-500 hover:text-red-700 font-bold px-3 shrink-0 border-l border-slate-100 dark:border-slate-800 flex items-center justify-center p-1 hover:bg-red-50 dark:hover:bg-slate-800 rounded"
                                      title="Delete Document"
                                    >
                                      <Trash size={16} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* New files staged for upload */}
                            {newFiles.length > 0 && (
                              <div className="space-y-1 mb-3">
                                {newFiles.map((file, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs">
                                    <span className="truncate text-emerald-700 font-semibold">+ {file.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditStaffDocFiles(prev => {
                                          const list = [...(prev[key] || [])];
                                          list.splice(idx, 1);
                                          return { ...prev, [key]: list };
                                        });
                                      }}
                                      className="text-red-500 hover:text-red-700 font-bold px-2 ml-2 shrink-0 flex items-center justify-center p-1 hover:bg-red-50 dark:hover:bg-slate-800 rounded"
                                      title="Remove Document"
                                    >
                                      <Trash size={16} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* File picker */}
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary-600 hover:text-primary-800">
                              <UploadCloud size={14} />
                              <span>Add file(s)</span>
                              <input
                                type="file"
                                multiple
                                accept=".pdf,image/*"
                                className="hidden"
                                onChange={e => {
                                  const selected = Array.from(e.target.files);
                                  const validFiles = [];
                                  selected.forEach(file => {
                                    if (file.size > 3145728 && !file.type.startsWith('audio/')) {
                                      toast.error(`File "${file.name}" exceeds the 3MB limit.`);
                                    } else {
                                      validFiles.push(file);
                                    }
                                  });
                                  setEditStaffDocFiles(prev => ({
                                    ...prev,
                                    [key]: [...(prev[key] || []), ...validFiles]
                                  }));
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <>
              {addStaffActiveTab === 'Personal Info' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                    {selectedStaffToView.photoUrl ? (
                      <img src={selectedStaffToView.photoUrl} alt="Staff Photograph" className="w-16 h-16 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-2xl">
                        {(selectedStaffToView.name || `${selectedStaffToView.firstName} ${selectedStaffToView.lastName}`).charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {selectedStaffToView.name || `${selectedStaffToView.firstName} ${selectedStaffToView.lastName}`}
                      </h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(selectedStaffToView.roles || [selectedStaffToView.role || 'Staffs']).map(r => (
                          <span key={r} className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-150 uppercase tracking-wider">{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Staff ID</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.staffId || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.email || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Mobile Number</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.mobileNumber || '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Date of Birth</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.dob || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Gender</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{normalizeGender(selectedStaffToView.gender, '—')}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Nationality</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.nationality || '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Marital Status</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.maritalStatus || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Blood Group</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.bloodGroup || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Emergency Contact</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.emergencyContact || '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Father / Guardian Name</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.fatherGuardianName || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Languages Known</label>
                      <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.languagesKnown || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Joined Date</label>
                      <p className="text-slate-900 dark:text-white font-semibold">
                        {selectedStaffToView.createdAt ? new Date(selectedStaffToView.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Staff Type</label>
                      <p className="text-slate-900 dark:text-white font-semibold capitalize">
                        {selectedStaffToView.staff_type || 'teaching'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Residential Address</label>
                    <p className="text-slate-900 dark:text-white font-semibold whitespace-pre-line">{selectedStaffToView.residentialAddress || '—'}</p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <CustomFieldsRenderer 
                      moduleKey="staff"
                      customData={selectedStaffToView.customData || {}}
                      readOnly={true}
                    />
                  </div>
                </div>
              )}

              {addStaffActiveTab === 'Education & Work' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Academic Qualifications</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Highest Qualification</label>
                        <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.highestQualification || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Degree & Specialization</label>
                        <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.degreeSpecialization || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">University / College</label>
                        <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.universityName || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Year of Passing</label>
                        <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.yearOfPassing || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Professional Experience</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Previous Experience (Years)</label>
                        <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.previousExperience || '0'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Previous Organization</label>
                        <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.previousOrganization || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Subject Specialization</label>
                        <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.subjectSpecialization || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Grades/Classes Handled</label>
                        <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.gradesClassesHandled || '—'}</p>
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Professional Certifications</label>
                        <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.professionalCertifications || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {addStaffActiveTab === 'Identity & Banking' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Authorized check */}
                  {(userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin') ? (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Government Identity & Payroll</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Government ID Type</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.govtIdType || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Government ID Number</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.govtIdNumber || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Aadhaar Number</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.aadharNumber || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">PAN Number</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.panNumber || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">PF Number</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.pfNumber || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">ESIC Number</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.esicNumber || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">UAN Number</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.uanNumber || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Tax Identification Details</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.taxIdDetails || '—'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Banking Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Bank Name</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.bankName || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Bank Account Number</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.bankAccountNumber || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Branch Name</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.branchName || '—'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">IFSC Code</label>
                            <p className="text-slate-900 dark:text-white font-semibold">{selectedStaffToView.ifscCode || '—'}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-700 text-sm font-medium flex items-center gap-2">
                      <ShieldCheck /> Government, salary, and banking details are restricted to authorized administrators.
                    </div>
                  )}
                </div>
              )}

              {addStaffActiveTab === 'Documents' && (
                <div className="space-y-4 animate-fade-in">
                  {[
                    { key: 'academicCertificates', label: 'Academic Certificates' },
                    { key: 'markSheets', label: 'Mark Sheets' },
                    { key: 'experienceCertificates', label: 'Experience Certificates' },
                    { key: 'relievingLetter', label: 'Relieving Letter' },
                    { key: 'resume', label: 'Resume / CV' },
                    { key: 'referenceLetters', label: 'Reference Letters' },
                    { key: 'govtIdDocument', label: 'Government ID Document' },
                    { key: 'salarySlips', label: 'Salary Slips' }
                  ].map(({ key, label }) => {
                    const files = selectedStaffToView[key] || [];
                    return (
                      <div key={key} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
                        <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{label}</label>
                        {files.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {files.map((file, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setPreviewUrl(file.url)}
                                className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-semibold text-indigo-600 text-left"
                              >
                                <Eye size={14} />
                                <span className="truncate">{file.name}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-300 italic">No documents uploaded</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              {isStaffEditMode ? (
                <>
                  <button
                    onClick={() => { setIsStaffEditMode(false); setEditStaffData(null); setEditStaffErrors({}); setEditStaffDocFiles({}); }}
                    className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveStaffEdit}
                    disabled={savingStaffEdit}
                    className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingStaffEdit ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /><span>Saving...</span></> : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditStaffData({ 
                        ...selectedStaffToView,
                        firstName: selectedStaffToView.firstName || selectedStaffToView.name?.split(' ')[0] || '',
                        lastName: selectedStaffToView.lastName || selectedStaffToView.name?.split(' ').slice(1).join(' ') || ''
                      });
                      setEditStaffErrors({});
                      setEditStaffDocFiles({});
                      setAddStaffActiveTab('Personal Info');
                      setIsStaffEditMode(true);
                    }}
                    className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl transition-colors shadow-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setViewStaffModalOpen(false); setIsStaffEditMode(false); setEditStaffData(null); setEditStaffDocFiles({}); }}
                    className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDeleteState.isOpen}
        title="Delete Staff Member"
        message={`Are you sure you want to delete the staff member "${confirmDeleteState.name}"? This action cannot be undone.`}
        onConfirm={() => handleDeleteStaff(confirmDeleteState.id)}
        onClose={() => setConfirmDeleteState({ isOpen: false, id: null, name: '' })}
        onCancel={() => setConfirmDeleteState({ isOpen: false, id: null, name: '' })}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Export Columns & Filename Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in-up border border-slate-100 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Export Staff Directory</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize file settings and select columns to export.</p>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* File Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Export File Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    placeholder="Enter file name"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all pr-12 font-medium"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300 text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">.xlsx</span>
                </div>
              </div>

              {/* Columns Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Select Columns to Include</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Role' },
                    { key: 'assignedClass', label: 'Assigned Class' },
                    { key: 'subjectClasses', label: 'Subject Classes' },
                    { key: 'mobile', label: 'Mobile' },
                    { key: 'qualification', label: 'Highest Qualification' }
                  ].map(({ key, label }) => (
                    <label 
                      key={key} 
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                        selectedFields[key] 
                          ? 'border-primary-200 bg-primary-50/30 text-primary-900 font-semibold' 
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields[key]}
                        onChange={() => handleFieldToggle(key)}
                        className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 h-4 w-4"
                      />
                      <span className="text-xs">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={exportToExcel}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2 text-sm"
              >
                <Download size={18} />
                Generate Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAFF INVITE MODAL */}
      {inviteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary-50 dark:bg-primary-950/40 text-primary-600 rounded-xl">
                  <LinkIcon size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Staff Registration Link</h3>
                  <p className="text-xs text-slate-400">Share with staff to complete password setup</p>
                </div>
              </div>
              <button
                onClick={() => setInviteModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Staff Recipient Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{inviteModal.staffName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{inviteModal.staffEmail}</p>
                </div>
                {inviteModal.staffEmpId && (
                  <span className="px-2.5 py-1 text-xs font-semibold bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 rounded-lg border border-primary-200 dark:border-primary-800">
                    ID: {inviteModal.staffEmpId}
                  </span>
                )}
              </div>

              {inviteModal.loading ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-2">
                  <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-400">Processing registration link...</span>
                </div>
              ) : (
                <>
                  {/* Link Input & Copy */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Secure Registration URL
                      </label>
                      {inviteModal.status === 'EXPIRED' ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200">
                          Expired
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200">
                          Active Link
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteModal.inviteUrl}
                        className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-700 dark:text-slate-300 focus:outline-none select-all"
                      />
                      <button
                        onClick={handleCopyInviteLink}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
                      >
                        <CopyIcon size={14} /> Copy
                      </button>
                    </div>
                  </div>

                  {/* Expiry & Status Meta */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Single-use link, valid for 48 hours</span>
                    </div>
                    {inviteModal.expiresAt && (
                      <span className="text-[11px] font-mono text-slate-400">
                        Expires: {new Date(inviteModal.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRegenerateInvite}
                disabled={inviteModal.loading}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 py-2 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Regenerate Link (Revokes Old)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendInviteEmail}
                  disabled={inviteModal.loading || inviteModal.emailSending || !inviteModal.inviteUrl}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Mail size={14} />
                  {inviteModal.emailSending ? 'Sending...' : 'Send by Email'}
                </button>
                <button
                  type="button"
                  onClick={() => setInviteModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 rounded-xl transition-all shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
