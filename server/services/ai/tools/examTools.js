/**
 * Controlled Read-Only Exam & Academic Performance Tools
 * Queries SchoolDocument collections for exams, assessments, and marks
 */

const examTools = [
  {
    name: 'get_student_exam_results',
    description: 'Get examination marks, grades, and subject-wise performance for a student.',
    module: 'exams',
    parameters: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'Unique UUID of the student'
        },
        admissionNo: {
          type: 'string',
          description: 'Admission number of the student'
        },
        examName: {
          type: 'string',
          description: 'Optional exam name (e.g. "Midterm", "Final Exam")'
        }
      }
    },
    handler: async ({ studentId, admissionNo, examName }, context) => {
      const { schoolId, user, prisma } = context;

      const student = await prisma.student.findFirst({
        where: {
          schoolId,
          ...(studentId ? { id: studentId } : {}),
          ...(admissionNo ? { admissionNo: admissionNo.trim() } : {})
        },
        include: { class: true }
      });

      if (!student) {
        return { error: 'Student not found.' };
      }

      // Check Parent role
      if (user.role === 'PARENT') {
        const link = await prisma.parentStudent.findFirst({
          where: { parent: { userId: user.id, schoolId }, studentId: student.id }
        });
        if (!link) {
          return { error: 'Access denied: You can only view exam marks of your own children.' };
        }
      }

      // Query exam assessments from SchoolDocument
      const assessmentDocs = await prisma.schoolDocument.findMany({
        where: {
          schoolId,
          collection: 'exam_assessments'
        }
      });

      const studentResults = [];

      for (const doc of assessmentDocs) {
        const data = doc.data || {};
        const examTitle = data.examName || data.title || 'Exam';
        if (examName && !examTitle.toLowerCase().includes(examName.toLowerCase())) {
          continue;
        }

        // Check if this assessment has marks for this student
        const marksMap = data.marks || data.results || {};
        const studentMark = marksMap[student.id] || marksMap[student.admissionNo];

        if (studentMark) {
          studentResults.push({
            examName: examTitle,
            subject: data.subject || data.subjectName || 'General',
            maxMarks: data.maxMarks || 100,
            obtainedMarks: studentMark.score !== undefined ? studentMark.score : studentMark,
            grade: studentMark.grade || calculateGrade(studentMark.score !== undefined ? studentMark.score : studentMark, data.maxMarks || 100)
          });
        }
      }

      return {
        student: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        className: student.class ? student.class.name : 'N/A',
        totalExamsRecorded: studentResults.length,
        results: studentResults.length > 0 ? studentResults : 'No published exam results found for this student.'
      };
    }
  },

  {
    name: 'get_class_exam_results',
    description: 'Get class marks and results for a specific exam and subject.',
    module: 'exams',
    parameters: {
      type: 'object',
      properties: {
        className: {
          type: 'string',
          description: 'Class name (e.g. "Grade 10", "Class 10")'
        },
        examName: {
          type: 'string',
          description: 'Name of the exam (e.g. "Term 1", "Midterm", "Final")'
        },
        subjectName: {
          type: 'string',
          description: 'Optional subject name to filter'
        }
      },
      required: ['className']
    },
    handler: async ({ className, examName, subjectName }, context) => {
      const { schoolId, user, prisma } = context;

      if (user.role === 'PARENT') {
        return { error: 'Access denied: Class-level exam performance is restricted to staff.' };
      }

      // Find class
      const cls = await prisma.class.findFirst({
        where: { schoolId, name: { contains: className.trim(), mode: 'insensitive' } },
        include: { students: { select: { id: true, firstName: true, lastName: true, admissionNo: true } } }
      });

      if (!cls) {
        return { error: `Class "${className}" not found.` };
      }

      const assessmentDocs = await prisma.schoolDocument.findMany({
        where: { schoolId, collection: 'exam_assessments' }
      });

      const matchedAssessments = assessmentDocs.filter(d => {
        const data = d.data || {};
        const matchesClass = data.classId === cls.id || (data.className && data.className.toLowerCase().includes(className.toLowerCase()));
        const matchesExam = !examName || (data.examName && data.examName.toLowerCase().includes(examName.toLowerCase()));
        const matchesSubj = !subjectName || (data.subject && data.subject.toLowerCase().includes(subjectName.toLowerCase()));
        return matchesClass && matchesExam && matchesSubj;
      });

      if (matchedAssessments.length === 0) {
        return {
          className: cls.name,
          message: `No exam assessments found matching "${examName || 'all exams'}" for ${cls.name}.`
        };
      }

      const summaries = matchedAssessments.map(doc => {
        const data = doc.data || {};
        const marks = data.marks || {};
        const scores = Object.values(marks).map(m => typeof m === 'object' ? (m.score || 0) : Number(m)).filter(n => !isNaN(n));
        const max = data.maxMarks || 100;
        const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'N/A';
        const highest = scores.length > 0 ? Math.max(...scores) : 'N/A';
        const lowest = scores.length > 0 ? Math.min(...scores) : 'N/A';

        return {
          exam: data.examName || 'Exam',
          subject: data.subject || 'Subject',
          maxMarks: max,
          studentsAssessedCount: scores.length,
          classAverage: avg,
          highestScore: highest,
          lowestScore: lowest
        };
      });

      return {
        className: cls.name,
        totalAssessments: summaries.length,
        assessments: summaries
      };
    }
  },

  {
    name: 'get_class_performance',
    description: 'Get comprehensive academic performance summary of a class, identifying top scoring students and overall subject averages.',
    module: 'exams',
    parameters: {
      type: 'object',
      properties: {
        className: {
          type: 'string',
          description: 'Class name (e.g. "Class 10")'
        }
      },
      required: ['className']
    },
    handler: async ({ className }, context) => {
      const { schoolId, user, prisma } = context;

      if (user.role === 'PARENT') {
        return { error: 'Access denied: Class performance analytics are restricted to staff.' };
      }

      const cls = await prisma.class.findFirst({
        where: { schoolId, name: { contains: className.trim(), mode: 'insensitive' } },
        include: {
          students: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
          subjects: true
        }
      });

      if (!cls) {
        return { error: `Class "${className}" not found.` };
      }

      const assessmentDocs = await prisma.schoolDocument.findMany({
        where: { schoolId, collection: 'exam_assessments' }
      });

      const studentTotals = {};
      cls.students.forEach(s => {
        studentTotals[s.id] = {
          name: `${s.firstName} ${s.lastName}`.trim(),
          admissionNo: s.admissionNo,
          totalScore: 0,
          totalMax: 0,
          examsCount: 0
        };
      });

      for (const doc of assessmentDocs) {
        const data = doc.data || {};
        if (data.classId === cls.id || (data.className && data.className.toLowerCase().includes(className.toLowerCase()))) {
          const marks = data.marks || {};
          const max = data.maxMarks || 100;
          for (const [studentId, markVal] of Object.entries(marks)) {
            if (studentTotals[studentId]) {
              const score = typeof markVal === 'object' ? (markVal.score || 0) : Number(markVal);
              studentTotals[studentId].totalScore += score;
              studentTotals[studentId].totalMax += max;
              studentTotals[studentId].examsCount += 1;
            }
          }
        }
      }

      const performanceList = Object.values(studentTotals)
        .filter(s => s.examsCount > 0)
        .map(s => ({
          name: s.name,
          admissionNo: s.admissionNo,
          overallPercentage: ((s.totalScore / s.totalMax) * 100).toFixed(1) + '%',
          numericPct: (s.totalScore / s.totalMax) * 100,
          examsTaken: s.examsCount
        }))
        .sort((a, b) => b.numericPct - a.numericPct);

      return {
        className: cls.name,
        totalStudents: cls.students.length,
        studentsWithExamData: performanceList.length,
        topPerformers: performanceList.slice(0, 5).map(({ name, admissionNo, overallPercentage, examsTaken }) => ({
          name, admissionNo, overallPercentage, examsTaken
        })),
        classOverallAverage: performanceList.length > 0
          ? (performanceList.reduce((sum, p) => sum + p.numericPct, 0) / performanceList.length).toFixed(1) + '%'
          : 'No marks recorded'
      };
    }
  }
];

function calculateGrade(score, max = 100) {
  const pct = (score / max) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

module.exports = examTools;
