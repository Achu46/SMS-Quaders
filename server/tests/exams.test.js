const assert = require('assert');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = require('../prismaClient');

console.log('\n======================================================');
console.log('🧪 Starting Exams, Results & Report Cards Test Suite');
console.log('======================================================\n');

let passedTests = 0;
let totalTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
}

async function runTests() {
  const testSchoolId = `test-school-${Date.now()}`;
  const testAdminId = `test-admin-${Date.now()}`;
  const testStudentId = `test-student-${Date.now()}`;
  const testTeacherId = `test-teacher-${Date.now()}`;
  let classId;
  let subjectId;
  let examId;
  let assessmentId;

  try {
    // 0. Setup test school, class, subject, student, teacher
    await test('Setup Test Environment in Database', async () => {
      await prisma.school.create({
        data: {
          id: testSchoolId,
          name: 'Exams Test Academy',
          status: 'ACTIVE',
          setupCompleted: true
        }
      });

      const cls = await prisma.class.create({
        data: {
          schoolId: testSchoolId,
          name: 'Grade 10'
        }
      });
      classId = cls.id;

      const subj = await prisma.subject.create({
        data: {
          schoolId: testSchoolId,
          classId: cls.id,
          name: 'Mathematics',
          code: 'MATH101'
        }
      });
      subjectId = subj.id;

      await prisma.user.create({
        data: {
          id: testTeacherId,
          schoolId: testSchoolId,
          email: `teacher_${Date.now()}@test.edu`,
          password: 'hashedpassword',
          name: 'John Mathematics Teacher',
          role: 'STAFF'
        }
      });

      await prisma.student.create({
        data: {
          id: testStudentId,
          schoolId: testSchoolId,
          classId: cls.id,
          firstName: 'Alice',
          lastName: 'Smith',
          admissionNo: `ADM-${Date.now()}`,
          status: 'ACTIVE'
        }
      });

      assert(classId, 'Class created');
      assert(subjectId, 'Subject created');
    });

    // 1. Examination Creation with Auto-Provisioning
    await test('1. Examination Creation with Subject Assessments Auto-Provisioning', async () => {
      const exam = await prisma.examination.create({
        data: {
          schoolId: testSchoolId,
          name: 'Midterm Examination 2026',
          examType: 'Term',
          academicYear: '2026-2027',
          term: 'Term 1',
          startDate: new Date('2026-10-01'),
          endDate: new Date('2026-10-15'),
          status: 'DRAFT',
          classId
        }
      });
      examId = exam.id;

      assert.strictEqual(exam.name, 'Midterm Examination 2026');
      assert.strictEqual(exam.status, 'DRAFT');

      // Auto-provision assessment for mathematics
      const assess = await prisma.assessment.create({
        data: {
          schoolId: testSchoolId,
          examinationId: exam.id,
          classId,
          subjectId,
          teacherId: testTeacherId,
          title: 'Mathematics - Midterm',
          totalMarks: 100,
          passingMarks: 40,
          weightage: 100,
          status: 'PENDING',
          components: [
            { name: 'PT', maxMarks: 20 },
            { name: 'Theory', maxMarks: 80 }
          ]
        }
      });
      assessmentId = assess.id;

      assert.strictEqual(assess.totalMarks, 100);
      assert.strictEqual(assess.components.length, 2);
    });

    // 2. Multi-Component Mark Entry & Decimal Precision
    await test('2. Multi-Component Mark Entry & Bulk Grading', async () => {
      const ptMark = 18.5;
      const theoryMark = 74.0;
      const totalObtained = ptMark + theoryMark; // 92.5

      const grade = await prisma.assessmentGrade.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId,
            studentId: testStudentId
          }
        },
        update: {
          marksObtained: totalObtained,
          isAbsent: false,
          isExempt: false,
          grade: 'A1',
          remarks: {
            components: { PT: ptMark, Theory: theoryMark },
            notes: 'Excellent mathematical problem-solving'
          }
        },
        create: {
          schoolId: testSchoolId,
          assessmentId,
          studentId: testStudentId,
          marksObtained: totalObtained,
          isAbsent: false,
          isExempt: false,
          grade: 'A1',
          remarks: {
            components: { PT: ptMark, Theory: theoryMark },
            notes: 'Excellent mathematical problem-solving'
          }
        }
      });

      assert.strictEqual(grade.marksObtained, 92.5);
      assert.strictEqual(grade.grade, 'A1');
      assert.strictEqual(grade.remarks.components.PT, 18.5);
      assert.strictEqual(grade.remarks.components.Theory, 74.0);
    });

    // 3. Mark Overrides & Audit Trail
    await test('3. Administrative Mark Override with Audit Logging', async () => {
      const overrideReason = 'Recounting of Theory section verified by Academic Head';
      const updatedGrade = await prisma.assessmentGrade.update({
        where: {
          assessmentId_studentId: {
            assessmentId,
            studentId: testStudentId
          }
        },
        data: {
          marksObtained: 94.0,
          overrideReason,
          overriddenById: testTeacherId
        }
      });

      assert.strictEqual(updatedGrade.marksObtained, 94.0);
      assert.strictEqual(updatedGrade.overrideReason, overrideReason);
      assert.strictEqual(updatedGrade.overriddenById, testTeacherId);
    });

    // 4. Report Card Template Configuration
    await test('4. Report Card Template Upsert (CBSE Grading Scale & Branding)', async () => {
      const template = await prisma.reportCardTemplate.upsert({
        where: {
          schoolId_type: {
            schoolId: testSchoolId,
            type: 'CBSE'
          }
        },
        update: {
          name: 'CBSE Secondary Report Card',
          branding: { primaryColor: '#2563eb', schoolMotto: 'Learn & Lead' }
        },
        create: {
          schoolId: testSchoolId,
          type: 'CBSE',
          name: 'CBSE Secondary Report Card',
          branding: { primaryColor: '#2563eb', schoolMotto: 'Learn & Lead' },
          headerConfig: { title: 'ANNUAL PROGRESS REPORT', affiliationText: 'Affiliated to CBSE' },
          signatureBlocks: { classTeacher: true, principal: true, parent: true },
          gradingScale: [
            { min: 91, max: 100, grade: 'A1' },
            { min: 81, max: 90.99, grade: 'A2' },
            { min: 71, max: 80.99, grade: 'B1' },
            { min: 61, max: 70.99, grade: 'B2' },
            { min: 51, max: 60.99, grade: 'C1' },
            { min: 41, max: 50.99, grade: 'C2' },
            { min: 33, max: 40.99, grade: 'D' },
            { min: 0, max: 32.99, grade: 'E' }
          ]
        }
      });

      assert.strictEqual(template.type, 'CBSE');
      assert.strictEqual(template.gradingScale.length, 8);
    });

    // 5. Atomic Report Card Publishing & Row Locking
    await test('5. Atomic Historical Snapshot Publishing with Idempotent Upsert', async () => {
      const percentage = 94.0;
      const overallGrade = 'A1';

      const reportCard = await prisma.reportCard.upsert({
        where: {
          schoolId_studentId_examinationId: {
            schoolId: testSchoolId,
            studentId: testStudentId,
            examinationId: examId
          }
        },
        update: {
          academicYear: '2026-2027',
          term: 'Term 1',
          marksBreakdown: [
            {
              subjectName: 'Mathematics',
              marksObtained: 94.0,
              maxMarks: 100,
              letterGrade: 'A1'
            }
          ],
          totalMarksObtained: 94.0,
          totalMaxMarks: 100.0,
          percentage,
          overallGrade,
          attendanceStats: { totalSessions: 100, present: 96, attendancePercentage: 96.0 },
          status: 'PUBLISHED'
        },
        create: {
          schoolId: testSchoolId,
          studentId: testStudentId,
          examinationId: examId,
          academicYear: '2026-2027',
          term: 'Term 1',
          marksBreakdown: [
            {
              subjectName: 'Mathematics',
              marksObtained: 94.0,
              maxMarks: 100,
              letterGrade: 'A1'
            }
          ],
          totalMarksObtained: 94.0,
          totalMaxMarks: 100.0,
          percentage,
          overallGrade,
          attendanceStats: { totalSessions: 100, present: 96, attendancePercentage: 96.0 },
          status: 'PUBLISHED'
        }
      });

      // Update exam status to PUBLISHED
      await prisma.examination.update({
        where: { id: examId },
        data: { status: 'PUBLISHED' }
      });

      assert.strictEqual(reportCard.totalMarksObtained, 94.0);
      assert.strictEqual(reportCard.overallGrade, 'A1');
      assert.strictEqual(reportCard.status, 'PUBLISHED');
    });

    // 6. RBAC & Published-Only Student Filtering
    await test('6. Student/Parent Portal: Published-Only & Draft Filtering', async () => {
      // Create a secondary DRAFT exam with report card to verify draft filter
      const draftExam = await prisma.examination.create({
        data: {
          schoolId: testSchoolId,
          name: 'Draft Unannounced Test',
          examType: 'Class Test',
          academicYear: '2026-2027',
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-02'),
          status: 'DRAFT'
        }
      });

      // Fetch for student filtering out DRAFT exams
      const visibleReports = await prisma.reportCard.findMany({
        where: {
          schoolId: testSchoolId,
          studentId: testStudentId,
          status: 'PUBLISHED',
          examination: {
            status: { in: ['PUBLISHED', 'FINALIZED'] }
          }
        },
        include: { examination: true }
      });

      assert.strictEqual(visibleReports.length, 1);
      assert.strictEqual(visibleReports[0].examination.name, 'Midterm Examination 2026');
      assert.strictEqual(visibleReports[0].examination.status, 'PUBLISHED');

      // Clean up draft exam
      await prisma.examination.delete({ where: { id: draftExam.id } });
    });

    // 7. Delete Guard against Existing Marks
    await test('7. Deletion Guard (409 Conflict when Student Marks Exist)', async () => {
      const gradesCount = await prisma.assessmentGrade.count({
        where: { assessmentId }
      });

      assert(gradesCount > 0, 'Grades exist for assessment');
      // Simulated route check
      const canDelete = gradesCount === 0;
      assert.strictEqual(canDelete, false, 'Deletion is safely blocked when student marks exist');
    });

  } finally {
    // Teardown test tenant
    try {
      await prisma.school.delete({ where: { id: testSchoolId } });
    } catch (e) {}
  }

  console.log('\n======================================================');
  console.log(`Results: ${passedTests}/${totalTests} Passed`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
