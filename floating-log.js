// 浮窗日志系统
class FloatingLog {
  constructor() {
    this.isVisible = false;
    this.logs = [];
    this.maxLogs = 50;
    this.createFloatingWindow();
  }

  // 创建浮窗
  createFloatingWindow() {
    // 创建主容器
    this.container = document.createElement('div');
    this.container.id = 'floating-log-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      max-height: 500px;
      background: rgba(0, 0, 0, 0.9);
      color: #fff;
      border-radius: 10px;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 12px;
      z-index: 10000;
      display: none;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
    `;

    // 创建标题栏
    this.header = document.createElement('div');
    this.header.style.cssText = `
      padding: 10px 15px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px 10px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    `;

    this.title = document.createElement('span');
    this.title.textContent = '🚀 Dreamina自动注册 - 运行日志';
    this.title.style.fontWeight = 'bold';

    this.closeBtn = document.createElement('button');
    this.closeBtn.textContent = '×';
    this.closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    this.closeBtn.onclick = () => this.hide();

    this.header.appendChild(this.title);
    this.header.appendChild(this.closeBtn);

    // 创建日志内容区域
    this.logContent = document.createElement('div');
    this.logContent.style.cssText = `
      padding: 10px 15px;
      max-height: 400px;
      overflow-y: auto;
      line-height: 1.4;
    `;

    // 创建控制按钮
    this.controls = document.createElement('div');
    this.controls.style.cssText = `
      padding: 10px 15px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      gap: 10px;
    `;

    this.clearBtn = document.createElement('button');
    this.clearBtn.textContent = '清空日志';
    this.clearBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: #fff;
      padding: 5px 10px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 11px;
    `;
    this.clearBtn.onclick = () => this.clear();

    this.exportBtn = document.createElement('button');
    this.exportBtn.textContent = '导出日志';
    this.exportBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: #fff;
      padding: 5px 10px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 11px;
    `;
    this.exportBtn.onclick = () => this.export();

    this.controls.appendChild(this.clearBtn);
    this.controls.appendChild(this.exportBtn);

    // 组装浮窗
    this.container.appendChild(this.header);
    this.container.appendChild(this.logContent);
    this.container.appendChild(this.controls);

    // 添加到页面
    document.body.appendChild(this.container);

    // 添加拖拽功能
    this.makeDraggable();
  }

  // 添加拖拽功能
  makeDraggable() {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    this.header.onmousedown = (e) => {
      isDragging = true;
      initialX = e.clientX - this.container.offsetLeft;
      initialY = e.clientY - this.container.offsetTop;
    };

    document.onmousemove = (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        // 限制不超出屏幕边界
        const maxX = window.innerWidth - this.container.offsetWidth;
        const maxY = window.innerHeight - this.container.offsetHeight;
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));

        this.container.style.left = currentX + 'px';
        this.container.style.top = currentY + 'px';
        this.container.style.right = 'auto';
      }
    };

    document.onmouseup = () => {
      isDragging = false;
    };
  }

  // 显示浮窗
  show() {
    this.container.style.display = 'block';
    this.isVisible = true;
  }

  // 隐藏浮窗
  hide() {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  // 切换显示状态
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  // 添加日志
  addLog(message, type = 'info', data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message,
      type,
      data
    };

    this.logs.push(logEntry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.updateDisplay();
  }

  // 更新显示
  updateDisplay() {
    if (!this.isVisible) return;

    this.logContent.innerHTML = '';
    
    this.logs.forEach(log => {
      const logElement = document.createElement('div');
      logElement.style.cssText = `
        margin: 5px 0;
        padding: 8px;
        border-radius: 5px;
        background: ${this.getTypeColor(log.type)};
        border-left: 3px solid ${this.getTypeBorderColor(log.type)};
      `;

      const timeSpan = document.createElement('span');
      timeSpan.textContent = `[${log.timestamp}] `;
      timeSpan.style.color = '#aaa';

      const messageSpan = document.createElement('span');
      messageSpan.textContent = log.message;

      logElement.appendChild(timeSpan);
      logElement.appendChild(messageSpan);

      if (log.data) {
        // 🔍 调试信息特殊显示
        if (this.isDebugInfo(log.data)) {
          this.addDebugInfoDisplay(logElement, log.data);
        } else {
          // 普通数据展示
          const dataDiv = document.createElement('div');
          dataDiv.style.cssText = `
            margin-top: 5px;
            padding: 5px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            font-family: monospace;
            font-size: 10px;
            color: #ddd;
          `;
          dataDiv.textContent = JSON.stringify(log.data, null, 2);
          logElement.appendChild(dataDiv);
        }
      }

      this.logContent.appendChild(logElement);
    });

    // 滚动到底部
    this.logContent.scrollTop = this.logContent.scrollHeight;
  }

  // 获取类型颜色
  getTypeColor(type) {
    const colors = {
      info: 'rgba(0, 123, 255, 0.2)',
      success: 'rgba(40, 167, 69, 0.2)',
      warning: 'rgba(255, 193, 7, 0.2)',
      error: 'rgba(220, 53, 69, 0.2)',
      debug: 'rgba(108, 117, 125, 0.2)'
    };
    return colors[type] || colors.info;
  }

  // 获取类型边框颜色
  getTypeBorderColor(type) {
    const colors = {
      info: '#007bff',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
      debug: '#6c757d'
    };
    return colors[type] || colors.info;
  }
  
  // 🔍 检查是否为调试信息
  isDebugInfo(data) {
    return data && (
      data.step || 
      data.context || 
      data.analysis || 
      data.headerComparison || 
      data.browserHeaders ||
      data.debugConfig ||
      data.timestamp
    );
  }
  
  // 🔍 添加调试信息显示
  addDebugInfoDisplay(logElement, data) {
    // 创建调试信息容器
    const debugContainer = document.createElement('div');
    debugContainer.style.cssText = `
      margin-top: 8px;
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid rgba(76, 175, 80, 0.3);
      border-radius: 5px;
      padding: 8px;
    `;
    
    // 添加调试标识
    const debugLabel = document.createElement('div');
    debugLabel.style.cssText = `
      font-size: 10px;
      color: #4CAF50;
      font-weight: bold;
      margin-bottom: 5px;
      text-transform: uppercase;
    `;
    debugLabel.textContent = '🔍 调试信息';
    debugContainer.appendChild(debugLabel);
    
    // 显示步骤信息
    if (data.step) {
      const stepDiv = document.createElement('div');
      stepDiv.style.cssText = `
        margin: 3px 0;
        padding: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      `;
      stepDiv.innerHTML = `<strong>步骤:</strong> ${data.step}`;
      debugContainer.appendChild(stepDiv);
    }
    
    // 显示上下文信息
    if (data.context) {
      const contextDiv = document.createElement('div');
      contextDiv.style.cssText = `
        margin: 3px 0;
        padding: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      `;
      contextDiv.innerHTML = `<strong>上下文:</strong> ${data.context}`;
      debugContainer.appendChild(contextDiv);
    }
    
    // 显示请求头信息
    if (data.browserHeaders) {
      const headersDiv = document.createElement('div');
      headersDiv.style.cssText = `
        margin: 3px 0;
        padding: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      `;
      headersDiv.innerHTML = `<strong>请求头数量:</strong> ${data.headerCount || Object.keys(data.browserHeaders).length}`;
      debugContainer.appendChild(headersDiv);
    }
    
    // 显示请求头对比
    if (data.headerComparison) {
      const comparisonDiv = document.createElement('div');
      comparisonDiv.style.cssText = `
        margin: 3px 0;
        padding: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      `;
      comparisonDiv.innerHTML = `<strong>请求头匹配:</strong> ${data.matchCount}/${data.totalCount}`;
      debugContainer.appendChild(comparisonDiv);
    }
    
    // 显示页面分析
    if (data.analysis) {
      const analysisDiv = document.createElement('div');
      analysisDiv.style.cssText = `
        margin: 3px 0;
        padding: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      `;
      analysisDiv.innerHTML = `<strong>页面分析:</strong> 表单=${data.analysis.hasForm}, 验证码=${data.analysis.hasCaptcha}`;
      debugContainer.appendChild(analysisDiv);
    }
    
    // 显示时间戳
    if (data.timestamp) {
      const timeDiv = document.createElement('div');
      timeDiv.style.cssText = `
        margin: 3px 0;
        padding: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        font-size: 9px;
        color: #888;
      `;
      timeDiv.innerHTML = `<strong>时间:</strong> ${new Date(data.timestamp).toLocaleString()}`;
      debugContainer.appendChild(timeDiv);
    }
    
    logElement.appendChild(debugContainer);
  }

  // 清空日志
  clear() {
    this.logs = [];
    this.updateDisplay();
  }

  // 导出日志
  export() {
    const logText = this.logs.map(log => 
      `[${log.timestamp}] ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dreamina-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 设置进度
  setProgress(current, total, message = '') {
    const progress = Math.round((current / total) * 100);
    this.addLog(`${message} 进度: ${current}/${total} (${progress}%)`, 'info');
  }

  // 设置状态
  setStatus(status, message = '') {
    this.addLog(`状态: ${status}${message ? ' - ' + message : ''}`, 'info');
  }
}

// 创建全局实例
window.floatingLog = new FloatingLog();

// 添加键盘快捷键 (Ctrl+Shift+D) - 避免与其他扩展冲突
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    window.floatingLog.toggle();
  }
});

// 添加备用快捷键 (Alt+L)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'L') {
    e.preventDefault();
    window.floatingLog.toggle();
  }
});

// 新增：在页面上添加一个浮窗日志按钮
function createFloatingLogButton() {
  // 检查是否已经存在按钮
  if (document.getElementById('floating-log-button')) {
    return;
  }
  
  const button = document.createElement('button');
  button.id = 'floating-log-button';
  button.innerHTML = '📋 显示日志';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 9999;
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 25px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
    font-family: 'Microsoft YaHei', Arial, sans-serif;
  `;
  
  button.onmouseover = () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
  };
  
  button.onmouseout = () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
  };
  
  button.onclick = () => {
    if (window.floatingLog) {
      window.floatingLog.show();
      button.innerHTML = '📋 隐藏日志';
      button.onclick = () => {
        window.floatingLog.hide();
        button.innerHTML = '📋 显示日志';
        button.onclick = () => {
          window.floatingLog.show();
          button.innerHTML = '📋 隐藏日志';
        };
      };
    } else {
      alert('浮窗日志系统未加载，请刷新页面重试');
    }
  };
  
  document.body.appendChild(button);
  console.log('✅ 浮窗日志按钮已创建，位于页面左上角');
}

// 页面加载完成后创建按钮
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createFloatingLogButton);
} else {
  createFloatingLogButton();
}

console.log('浮窗日志系统已加载，按 Ctrl+Shift+D 或 Alt+L 切换显示，或点击页面左上角的"📋 显示日志"按钮');
