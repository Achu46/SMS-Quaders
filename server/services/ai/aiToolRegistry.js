const studentTools = require('./tools/studentTools');
const attendanceTools = require('./tools/attendanceTools');
const feeTools = require('./tools/feeTools');
const examTools = require('./tools/examTools');
const timetableTools = require('./tools/timetableTools');
const schoolTools = require('./tools/schoolTools');
const { hasPermission } = require('../../middleware');

// Aggregate all read-only tools
const allTools = [
  ...studentTools,
  ...attendanceTools,
  ...feeTools,
  ...examTools,
  ...timetableTools,
  ...schoolTools,
];

class AiToolRegistry {
  constructor() {
    this.tools = new Map();
    allTools.forEach(tool => this.registerTool(tool));
  }

  registerTool(tool) {
    if (!tool.name || typeof tool.handler !== 'function') {
      throw new Error(`Invalid tool registration: missing name or handler`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Filters available tools based on user's role and granular module permissions
   */
  getAvailableToolsForUser(user) {
    if (!user) return [];

    const isSuperOrAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

    return Array.from(this.tools.values()).filter(tool => {
      // Admins have access to all read-only tools
      if (isSuperOrAdmin) return true;

      // Staff access check based on permissions
      if (user.role === 'STAFF') {
        if (!tool.module) return true;
        return hasPermission(user.staffRole, tool.module, 'VIEW');
      }

      // Parents and Students have read access to student/attendance/fee/exam self-scoped tools
      if (user.role === 'PARENT' || user.role === 'STUDENT') {
        const allowedModules = ['students', 'attendance', 'fees', 'exams', 'timetables'];
        return allowedModules.includes(tool.module);
      }

      return false;
    });
  }

  /**
   * Executes a requested tool with tenant isolation context and permission checks
   */
  async executeTool(toolName, args, context) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        error: `Tool "${toolName}" is not registered in the ERP AI system.`,
        success: false
      };
    }

    const { user } = context;

    // Permission Verification
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      if (user.role === 'STAFF' && tool.module && !hasPermission(user.staffRole, tool.module, 'VIEW')) {
        return {
          error: `Permission Denied: You do not have permission to view ${tool.module} data.`,
          success: false
        };
      }
    }

    try {
      const result = await tool.handler(args || {}, context);
      return {
        success: !result.error,
        data: result
      };
    } catch (err) {
      console.error(`AI Tool Execution Failed [${toolName}]:`, err);
      return {
        error: `Failed to execute ERP tool "${toolName}".`,
        details: err.message,
        success: false
      };
    }
  }
}

module.exports = new AiToolRegistry();
