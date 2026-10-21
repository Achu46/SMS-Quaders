const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken, requireTenantAccess } = require('../middleware');
const whatsappService = require('../services/whatsappService');

// Helper to retrieve school WhatsApp integration settings
async function getSchoolWhatsAppConfig(prisma, schoolId) {
  if (!prisma || !schoolId || schoolId === 'global') return null;

  try {
    const doc = await prisma.schoolDocument.findFirst({
      where: { schoolId, collection: 'settings' }
    });
    return doc?.data?.integrations?.whatsapp || null;
  } catch (e) {
    return null;
  }
}

// POST /api/whatsapp-service
router.post('/', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { action, credentials, ptmData, noticeData } = req.body;
    const schoolId = req.schoolId;
    const prisma = req.prisma;

    if (action === 'test') {
      const config = credentials || (await getSchoolWhatsAppConfig(prisma, schoolId)) || {};
      const result = await whatsappService.testConnection({
        accessToken: config.accessToken,
        phoneNumberId: config.phoneNumberId
      });
      return res.json(result);
    }

    if (action === 'sendPTM') {
      const config = (await getSchoolWhatsAppConfig(prisma, schoolId)) || {};
      const parentPhone = ptmData?.parentPhone || ptmData?.phone || '9999999999';
      const templateName = config.ptmTemplateName || 'school_ptm_scheduled';

      const components = whatsappService.buildPTMComponents({
        parentName: ptmData?.parentName,
        studentName: ptmData?.studentName,
        date: ptmData?.date,
        time: ptmData?.time,
        meetingType: ptmData?.type
      });

      const result = await whatsappService.sendTemplateMessage({
        accessToken: config.accessToken,
        phoneNumberId: config.phoneNumberId,
        recipientPhone: parentPhone,
        templateName,
        components
      });

      return res.json(result);
    }

    if (action === 'sendNotice') {
      const config = (await getSchoolWhatsAppConfig(prisma, schoolId)) || {};
      const targetPhone = noticeData?.recipientPhone || noticeData?.phone || '9999999999';
      const templateName = config.noticeTemplateName || 'school_notice_notification';

      const components = whatsappService.buildNoticeComponents({
        noticeTitle: noticeData?.title,
        noticeDate: noticeData?.date,
        audience: noticeData?.audience
      });

      const result = await whatsappService.sendTemplateMessage({
        accessToken: config.accessToken,
        phoneNumberId: config.phoneNumberId,
        recipientPhone: targetPhone,
        templateName,
        components
      });

      return res.json(result);
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error('WhatsApp service route error:', error);
    res.status(500).json({ error: error.message || 'WhatsApp service error' });
  }
});

module.exports = router;
