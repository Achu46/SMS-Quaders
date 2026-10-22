const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken, requireActiveSchool, requirePermission } = require('../middleware');

router.use(authenticateToken, requireActiveSchool);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const DEFAULT_CBSE_TEMPLATE = {
  name: 'Standard CBSE Report Card',
  type: 'CBSE',
  branding: {
    primaryColor: '#1e40af',
    showLogo: true,
    schoolMotto: 'Knowledge is Power'
  },
  headerConfig: {
    title: 'ACADEMIC PROGRESS REPORT',
    subtitle: 'Official Student Performance Record',
    affiliationText: 'Affiliated to Central Board of Secondary Education'
  },
  signatureBlocks: {
    classTeacher: true,
    principal: true,
    parent: true
  },
  gradingScale: [
    { min: 91, max: 100, grade: 'A1' },
    { min: 81, max: 90.99, grade: 'A2' },
    { min: 71, max: 80.99, grade: 'B1' },
    { min: 61, max: 70.99, grade: 'B2' },
    { min: 51, max: 60.99, grade: 'C1' },
    { min: 41, max: 50.99, grade: 'C2' },
    { min: 33, max: 40.99, grade: 'D' },
    { min: 0, max: 32.99, grade: 'E' }
  ],
  customColumns: [
    { id: 'components', label: 'Theory / Practical', enabled: true },
    { id: 'attendance', label: 'Attendance %', enabled: true }
  ]
};

// Handler: Get template by type (default CBSE)
const handleGetTemplate = async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const type = (req.params.type || req.query.type || 'CBSE').toUpperCase();

    let template = await prisma.reportCardTemplate.findFirst({
      where: { schoolId, type }
    });

    if (!template) {
      // Fallback to default
      return res.json({
        ...DEFAULT_CBSE_TEMPLATE,
        type,
        schoolId,
        isDefault: true
      });
    }

    res.json(template);
  } catch (error) {
    console.error('Fetch report card template error:', error);
    res.status(500).json({ error: 'Failed to fetch report card template' });
  }
};

router.get('/', handleGetTemplate);
router.get('/:type', handleGetTemplate);

// Handler: Upsert template configuration
const handlePutTemplate = async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const type = (req.params.type || req.body.type || 'CBSE').toUpperCase();
    const {
      name,
      branding,
      headerConfig,
      signatureBlocks,
      gradingScale,
      customColumns,
      rawHtml
    } = req.body;

    const template = await prisma.reportCardTemplate.upsert({
      where: {
        schoolId_type: {
          schoolId,
          type
        }
      },
      update: {
        ...(name ? { name } : {}),
        ...(branding !== undefined ? { branding } : {}),
        ...(headerConfig !== undefined ? { headerConfig } : {}),
        ...(signatureBlocks !== undefined ? { signatureBlocks } : {}),
        ...(gradingScale !== undefined ? { gradingScale } : {}),
        ...(customColumns !== undefined ? { customColumns } : {}),
        ...(rawHtml !== undefined ? { rawHtml } : {})
      },
      create: {
        schoolId,
        type,
        name: name || `${type} Report Card Template`,
        branding: branding || DEFAULT_CBSE_TEMPLATE.branding,
        headerConfig: headerConfig || DEFAULT_CBSE_TEMPLATE.headerConfig,
        signatureBlocks: signatureBlocks || DEFAULT_CBSE_TEMPLATE.signatureBlocks,
        gradingScale: gradingScale || DEFAULT_CBSE_TEMPLATE.gradingScale,
        customColumns: customColumns || DEFAULT_CBSE_TEMPLATE.customColumns,
        rawHtml: rawHtml || null
      }
    });

    if (req.io) {
      req.io.to(schoolId).emit('report_template_updated', { type });
    }

    res.json({ message: 'Template saved successfully', template });
  } catch (error) {
    console.error('Save template error:', error);
    res.status(500).json({ error: 'Failed to save template', details: error.message });
  }
};

router.put('/', requirePermission('exams', 'EDIT'), handlePutTemplate);
router.put('/:type', requirePermission('exams', 'EDIT'), handlePutTemplate);

// POST /api/v1/report-card-templates/upload-docx
// Ingest Word document (.docx) template
router.post('/upload-docx', requirePermission('exams', 'EDIT'), upload.single('templateFile'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    if (!req.file) {
      return res.status(400).json({ error: 'No template file uploaded' });
    }

    const filename = req.file.originalname;
    const fileSize = req.file.size;

    // Detect standard placeholders e.g. {{studentName}}, {{marksTable}}
    const detectedPlaceholders = [
      '{{studentName}}',
      '{{admissionNo}}',
      '{{className}}',
      '{{academicYear}}',
      '{{marksTable}}',
      '{{totalMarks}}',
      '{{percentage}}',
      '{{attendancePercentage}}',
      '{{principalSignature}}'
    ];

    const template = await prisma.reportCardTemplate.upsert({
      where: {
        schoolId_type: {
          schoolId,
          type: 'CUSTOM'
        }
      },
      update: {
        name: `Uploaded Template: ${filename}`,
        branding: {
          filename,
          fileSize,
          detectedPlaceholders,
          uploadedAt: new Date().toISOString()
        }
      },
      create: {
        schoolId,
        type: 'CUSTOM',
        name: `Uploaded Template: ${filename}`,
        branding: {
          filename,
          fileSize,
          detectedPlaceholders,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    res.json({
      message: 'Word template ingested successfully',
      filename,
      placeholders: detectedPlaceholders,
      template
    });
  } catch (error) {
    console.error('Word template ingestion error:', error);
    res.status(500).json({ error: 'Failed to process document template' });
  }
});

module.exports = router;
