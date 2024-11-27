const scan = require('scan-analysis-lib');

const scanService = {
    async scanProject(options) {
        try {
            console.log('开始扫描项目...');
            const result = await scan(options);
            return result;
        } catch (error) {
            console.error('扫描失败:', error);
            throw error;
        }
    }
};

module.exports = scanService;