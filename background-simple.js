// 简化版本的background.js，用于测试基本功能
let isMonitoring = false;
let currentStep = 'idle';
let stepProgress = { current: 0, total: 0 };

// 🔍 调试模式配置
const DEBUG_CONFIG = {
  enabled: true,           // 启用调试模式
  showHeaders: true,       // 显示请求头详情
  showPageAnalysis: true,  // 显示页面分析详情
  showCaptchaDetection: true, // 显示验证码检测详情
  showRequestComparison: true, // 显示请求对比详情
  verboseLogging: true     // 详细日志记录
};

// 浏览器请求头配置 - 模拟真实浏览器请求
const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  'Connection': 'keep-alive',
  'Sec-Ch-Ua': '"Google Chrome";v="139", "Chromium";v="139", "Not?A_Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
};

// 邮箱系统配置
const EMAIL_CONFIG = {
  adminUrl: 'http://mail.turtur.us:8010',
  loginUrl: 'http://mail.turtur.us:8010/Center/Index/login', // 修正：使用正确的登录URL
  webmailUrl: 'http://mail.turtur.us:8000',
  adminCredentials: { username: 'ceshi', password: 'ceshi123' },
  defaultPassword: 'Dreamina2024!', // 符合要求的复杂密码：8-20字符，包含数字和字母
  domain: 'tiktokaccu.com'
};

// Dreamina注册配置
const DREAMINA_CONFIG = {
  baseUrl: 'https://dreamina.capcut.com',
  loginUrl: 'https://dreamina.capcut.com/ai-tool/login',
  registerUrl: 'https://dreamina.capcut.com/ai-tool/login',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// 验证码配置
const VERIFICATION_CONFIG = {
  // 启用自动验证码识别
  autoGetVerificationCode: true, // 开启自动获取
  verificationCodeTimeout: 30000, // 验证码等待超时时间（毫秒）
  maxVerificationAttempts: 3,    // 最大验证码尝试次数
  // 图片验证码识别配置
  imageVerification: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 2000, // 重试间隔2秒
    ocrService: 'bingtop' // 使用冰拓验证码识别服务
  }
};

// 冰拓验证码识别服务配置
const BINGTOP_OCR_CONFIG = {
  apiUrl: 'http://www.bingtop.com/ocr/upload/',
  username: '743471562',
  password: '743471562',
  captchaType: 1001, // 通用验证码类型
  timeout: 60000 // 60秒超时（长连接阻塞模式）
};

// 检查内容脚本连接状态
async function checkContentScriptConnection(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return response && response.success;
  } catch (error) {
    console.log('Content script connection check failed:', error.message);
    return false;
  }
}

// 重新注入内容脚本
async function reinjectContentScripts(tabId) {
  try {
    console.log('Re-injecting content scripts to tab:', tabId);
    
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['floating-log.js', 'content.js']
    });
    
    console.log('Content scripts re-injected successfully');
    
    // 等待脚本加载
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return true;
  } catch (error) {
    console.error('Failed to re-inject content scripts:', error);
    return false;
  }
}

// 发送日志到内容脚本
async function sendLogToContent(message, type = 'info', data = null) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.log('No active tab found, skipping log');
      return;
    }

    // 检查内容脚本连接
    let isConnected = await checkContentScriptConnection(tab.id);
    
    if (!isConnected) {
      console.log('Content script not connected, attempting to re-inject...');
      isConnected = await reinjectContentScripts(tab.id);
    }
    
    if (isConnected) {
      // 发送日志消息
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'addLog',
          log: { message, type, data }
        });
      } catch (sendError) {
        console.error('Failed to send log message:', sendError);
        // 如果发送失败，尝试重新注入
        await reinjectContentScripts(tab.id);
      }
    } else {
      console.log('Content script injection failed, logging to console only');
      console.log(`[${type.toUpperCase()}] ${message}`, data);
    }
    
  } catch (error) {
    console.error('Failed to send log to content script:', error);
    // 不抛出错误，让主流程继续执行
    console.log(`[${type.toUpperCase()}] ${message}`, data);
  }
}

// 🔍 调试日志函数 - 根据调试模式决定是否显示详细信息
async function sendDebugLog(message, type = 'info', data = null, debugType = null) {
  if (!DEBUG_CONFIG.enabled) return;
  
  // 根据调试类型决定是否显示
  if (debugType === 'headers' && !DEBUG_CONFIG.showHeaders) return;
  if (debugType === 'pageAnalysis' && !DEBUG_CONFIG.showPageAnalysis) return;
  if (debugType === 'captchaDetection' && !DEBUG_CONFIG.showCaptchaDetection) return;
  if (debugType === 'requestComparison' && !DEBUG_CONFIG.showRequestComparison) return;
  
  await sendLogToContent(`🔍 [调试] ${message}`, type, data);
}

// 🔍 步骤可视化函数 - 显示当前步骤的详细信息
async function showStepVisualization(stepName, stepData = {}) {
  if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.verboseLogging) return;
  
  const stepInfo = {
    step: stepName,
    timestamp: new Date().toISOString(),
    data: stepData,
    debugMode: DEBUG_CONFIG
  };
  
  await sendLogToContent(`🔍 [步骤可视化] ${stepName}`, 'info', stepInfo);
}

// 🔍 请求头可视化函数 - 显示请求头的详细信息
async function showHeadersVisualization(headers, context = '') {
  if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.showHeaders) return;
  
  const headerInfo = {
    context: context,
    headers: headers,
    headerCount: Object.keys(headers).length,
    timestamp: new Date().toISOString()
  };
  
  await sendLogToContent(`🔍 [请求头可视化] ${context}`, 'info', headerInfo);
}

// 🔍 页面分析可视化函数 - 显示页面分析的详细信息
async function showPageAnalysisVisualization(analysisData, context = '') {
  if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.showPageAnalysis) return;
  
  const analysisInfo = {
    context: context,
    analysis: analysisData,
    timestamp: new Date().toISOString()
  };
  
  await sendLogToContent(`🔍 [页面分析可视化] ${context}`, 'info', analysisInfo);
}

// 🔍 调试信息汇总函数 - 在流程结束时显示所有关键信息
async function showDebugSummary(stepName, status, data = {}) {
  if (!DEBUG_CONFIG.enabled) return;
  
  const summary = {
    step: stepName,
    status: status,
    timestamp: new Date().toISOString(),
    debugConfig: DEBUG_CONFIG,
    data: data,
    browserHeaders: BROWSER_HEADERS,
    headerCount: Object.keys(BROWSER_HEADERS).length
  };
  
  await sendLogToContent(`🔍 [调试汇总] ${stepName} - ${status}`, 'info', summary);
}

// 🔍 调试模式状态检查函数
async function checkDebugModeStatus() {
  if (!DEBUG_CONFIG.enabled) return;
  
  const status = {
    debugMode: '已启用',
    timestamp: new Date().toISOString(),
    config: {
      showHeaders: DEBUG_CONFIG.showHeaders ? '已启用' : '已禁用',
      showPageAnalysis: DEBUG_CONFIG.showPageAnalysis ? '已启用' : '已禁用',
      showCaptchaDetection: DEBUG_CONFIG.showCaptchaDetection ? '已启用' : '已禁用',
      showRequestComparison: DEBUG_CONFIG.showRequestComparison ? '已启用' : '已禁用',
      verboseLogging: DEBUG_CONFIG.verboseLogging ? '已启用' : '已禁用'
    },
    browserHeaders: {
      count: Object.keys(BROWSER_HEADERS).length,
      headers: Object.keys(BROWSER_HEADERS)
    }
  };
  
  await sendLogToContent('🔍 [调试状态] 调试模式状态检查', 'info', status);
}

// 使用验证码登录邮箱管理后台
async function loginWithCaptcha(pageHtml) {
  try {
    await sendLogToContent('🔐 开始验证码登录流程...', 'info', { subStep: '验证码登录开始' });
    
    // 查找验证码图片URL
    let captchaUrl = null;
    
    // 尝试多种方法查找验证码图片
    const captchaEndpoints = [
      '/Index/captcha',  // 我们测试成功的端点
      '/captcha',
      '/captcha.php',
      '/captcha.jpg',
      '/captcha.png'
    ];
    
    for (const endpoint of captchaEndpoints) {
      const testUrl = `${EMAIL_CONFIG.adminUrl}${endpoint}`;
      try {
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: BROWSER_HEADERS
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.startsWith('image/')) {
            captchaUrl = testUrl;
            await sendLogToContent(`✅ 找到验证码图片: ${captchaUrl}`, 'info', { 
              captchaUrl: captchaUrl,
              contentType: contentType,
              subStep: '验证码图片查找'
            });
            break;
          }
        }
      } catch (error) {
        // 继续尝试下一个端点
      }
    }
    
    if (!captchaUrl) {
      throw new Error('未找到验证码图片');
    }
    
    // 下载验证码图片
    await sendLogToContent('📥 正在下载验证码图片...', 'info', { 
      imageUrl: captchaUrl,
      subStep: '图片下载'
    });
    
    const imageResponse = await fetch(captchaUrl, {
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    
    if (!imageResponse.ok) {
      throw new Error(`图片下载失败: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageBlob = await imageResponse.blob();
    await sendLogToContent(`✅ 验证码图片下载成功，大小: ${imageBlob.size} 字节`, 'info', { 
      imageSize: imageBlob.size,
      imageType: imageBlob.type,
      subStep: '图片下载完成'
    });
    
    // 识别验证码
    await sendLogToContent('🔍 开始识别验证码...', 'info', { subStep: '验证码识别' });
    
    const ocrResult = await bingtopOCR(imageBlob);
    if (!ocrResult.success) {
      throw new Error(`验证码识别失败: ${ocrResult.error}`);
    }
    
    await sendLogToContent(`✅ 验证码识别成功: ${ocrResult.code}`, 'info', { 
      captchaCode: ocrResult.code,
      confidence: ocrResult.confidence,
      subStep: '验证码识别成功'
    });
    
    // 分析登录表单字段
    await sendLogToContent('🔍 分析登录表单字段...', 'info', { subStep: '表单字段分析' });
    
    // 查找验证码字段名
    const captchaFieldPatterns = [
      /name=["']([^"']*captcha[^"']*)["']/i,
      /name=["']([^"']*code[^"']*)["']/i,
      /name=["']([^"']*验证码[^"']*)["']/i
    ];
    
    let captchaFieldName = 'captcha'; // 默认字段名
    for (const pattern of captchaFieldPatterns) {
      const match = pageHtml.match(pattern);
      if (match) {
        captchaFieldName = match[1];
        await sendLogToContent(`🔍 找到验证码字段名: ${captchaFieldName}`, 'info', { 
          fieldName: captchaFieldName,
          pattern: pattern.source,
          subStep: '字段名查找'
        });
        break;
      }
    }
    
    // 查找隐藏字段
    const hiddenFieldMatches = pageHtml.match(/<input[^>]*type=["']hidden["'][^>]*>/gi);
    const hiddenFields = {};
    if (hiddenFieldMatches) {
      for (const hiddenField of hiddenFieldMatches) {
        const nameMatch = hiddenField.match(/name=["']([^"']*)["']/i);
        const valueMatch = hiddenField.match(/value=["']([^"']*)["']/i);
        if (nameMatch) {
          const name = nameMatch[1];
          const value = valueMatch ? valueMatch[1] : '';
          hiddenFields[name] = value;
        }
      }
    }
    
    // 构建登录数据
    const loginData = new URLSearchParams();
    loginData.append('username', EMAIL_CONFIG.adminCredentials.username);
    loginData.append('password', EMAIL_CONFIG.adminCredentials.password);
    loginData.append(captchaFieldName, ocrResult.code);
    
    // 添加隐藏字段
    for (const [name, value] of Object.entries(hiddenFields)) {
      loginData.append(name, value);
    }
    
    await sendLogToContent(`📋 完整登录数据: ${loginData.toString()}`, 'info', { 
      loginData: loginData.toString(),
      captchaFieldName: captchaFieldName,
      hiddenFields: Object.keys(hiddenFields),
      subStep: '登录数据构建'
    });
    
    // 提交登录请求
    await sendLogToContent('🔐 提交验证码登录请求...', 'info', { subStep: '登录请求提交' });
    
    const loginResponse = await fetch(EMAIL_CONFIG.loginUrl, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: loginData.toString()
    });
    
    await sendLogToContent(`📊 登录响应: ${loginResponse.status} ${loginResponse.statusText}`, 'info', { 
      status: loginResponse.status,
      statusText: loginResponse.statusText,
      subStep: '登录响应'
    });
    
    const responseText = await loginResponse.text();
    const hasSuccess = responseText.includes('dashboard') || responseText.includes('logout') || responseText.includes('欢迎');
    const stillOnLoginPage = responseText.includes('login') || responseText.includes('用户名') || responseText.includes('密码');
    
    await sendLogToContent(`🔍 登录结果: 成功=${hasSuccess}, 仍在登录页=${stillOnLoginPage}`, 'info', { 
      hasSuccess,
      stillOnLoginPage,
      subStep: '登录结果分析'
    });
    
    if (hasSuccess && !stillOnLoginPage) {
      await sendLogToContent('✅ 验证码登录成功！', 'success', { 
        subStep: '登录成功'
      });
      return true;
    } else {
      throw new Error('验证码登录失败：仍在登录页面');
    }
    
  } catch (error) {
    await sendLogToContent(`❌ 验证码登录失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '验证码登录失败'
    });
    throw error;
  }
}

// 冰拓验证码识别服务
async function bingtopOCR(imageBlob) {
  try {
    await sendLogToContent('🔍 开始使用冰拓验证码识别服务...', 'info', { 
      service: 'bingtop',
      apiUrl: BINGTOP_OCR_CONFIG.apiUrl
    });
    
    // 将图片转换为base64
    const base64Data = await blobToBase64(imageBlob);
    await sendLogToContent(`📸 图片已转换为base64，长度: ${base64Data.length}`, 'info', { 
      base64Length: base64Data.length 
    });
    
    // 构建请求数据
    const postData = {
      username: BINGTOP_OCR_CONFIG.username,
      password: BINGTOP_OCR_CONFIG.password,
      captchaType: BINGTOP_OCR_CONFIG.captchaType,
      captchaData: base64Data
    };
    
    await sendLogToContent('📤 正在发送验证码识别请求...', 'info', { 
      username: BINGTOP_OCR_CONFIG.username,
      captchaType: BINGTOP_OCR_CONFIG.captchaType
    });
    
    // 新增：先测试冰拓服务是否可用
    try {
      const testResponse = await fetch(BINGTOP_OCR_CONFIG.apiUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10秒超时
      });
      
      if (!testResponse.ok) {
        throw new Error(`冰拓服务不可用: ${testResponse.status} ${testResponse.statusText}`);
      }
      
      await sendLogToContent('✅ 冰拓服务连接正常', 'success', { 
        serviceStatus: 'available',
        status: testResponse.status
      });
      
    } catch (testError) {
      await sendLogToContent(`⚠️ 冰拓服务连接测试失败: ${testError.message}`, 'warning', { 
        testError: testError.message,
        subStep: '服务可用性测试'
      });
      
      // 如果服务不可用，直接抛出错误，让调用方处理
      throw new Error(`冰拓服务不可用: ${testError.message}`);
    }
    
    // 发送POST请求到冰拓服务
    const response = await fetch(BINGTOP_OCR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: new URLSearchParams(postData),
      signal: AbortSignal.timeout(BINGTOP_OCR_CONFIG.timeout)
    });
    
    if (!response.ok) {
      throw new Error(`冰拓服务响应错误: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    await sendLogToContent(`📊 冰拓服务响应: ${JSON.stringify(result)}`, 'info', { 
      response: result 
    });
    
    if (result.code === 0 && result.data && result.data.recognition) {
      const recognition = result.data.recognition;
      await sendLogToContent(`✅ 冰拓验证码识别成功: ${recognition}`, 'success', { 
        recognition: recognition,
        captchaId: result.data.captchaId
      });
      return {
        success: true,
        code: recognition,
        confidence: 'high',
        service: 'bingtop',
        captchaId: result.data.captchaId
      };
    } else {
      throw new Error(`冰拓识别失败: ${result.message || '未知错误'}`);
    }
    
  } catch (error) {
    // 新增：详细错误分类
    let errorType = 'unknown';
    let errorDetails = error.message;
    
    if (error.name === 'AbortError') {
      errorType = 'timeout';
      errorDetails = '请求超时';
    } else if (error.message.includes('Failed to fetch')) {
      errorType = 'network';
      errorDetails = '网络请求失败，可能是CORS问题或服务不可用';
    } else if (error.message.includes('冰拓服务不可用')) {
      errorType = 'service_unavailable';
      errorDetails = '冰拓OCR服务不可用';
    } else if (error.message.includes('冰拓服务响应错误')) {
      errorType = 'service_error';
      errorDetails = '冰拓服务返回错误状态码';
    }
    
    await sendLogToContent(`❌ 冰拓验证码识别失败: ${errorDetails}`, 'error', { 
      error: error.message,
      errorType: errorType,
      errorDetails: errorDetails,
      service: 'bingtop',
      subStep: '错误分类'
    });
    
    return {
      success: false,
      error: errorDetails,
      errorType: errorType,
      service: 'bingtop'
    };
  }
}

// 将Blob转换为base64
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // 移除data:image/...;base64,前缀
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 测试网络连接
async function testNetworkConnection() {
  try {
    await sendLogToContent('🌐 开始测试网络连接...', 'info', { subStep: '网络连接测试' });
    
    const testUrls = [
      EMAIL_CONFIG.loginUrl,
      EMAIL_CONFIG.adminUrl,
      EMAIL_CONFIG.webmailUrl
    ];
    
    const results = {};
    
    for (const url of testUrls) {
      try {
        await sendLogToContent(`🔗 测试连接: ${url}`, 'info', { 
          url: url,
          subStep: '连接测试'
        });
        
        const startTime = Date.now();
        
        // 尝试不同的请求模式
        let response = null;
        let testMode = '';
        
        try {
          // 模式1: 标准fetch
          response = await fetch(url, {
            method: 'GET',
            cache: 'no-cache'
          });
          testMode = 'standard';
        } catch (standardError) {
          try {
            // 模式2: no-cors模式
            response = await fetch(url, {
              method: 'GET',
              mode: 'no-cors',
              cache: 'no-cache'
            });
            testMode = 'no-cors';
          } catch (noCorsError) {
            // 模式3: 使用XMLHttpRequest
            response = await makeXHRRequest(url, 'GET');
            testMode = 'xhr';
          }
        }
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        results[url] = {
          success: true,
          responseTime: responseTime,
          status: response.status || 'no-cors',
          statusText: response.statusText || 'no-cors mode',
          testMode: testMode
        };
        
        await sendLogToContent(`✅ 连接成功: ${url} (${responseTime}ms, 模式: ${testMode})`, 'success', { 
          url: url,
          responseTime: responseTime,
          testMode: testMode,
          subStep: '连接测试成功'
        });
        
      } catch (error) {
        results[url] = {
          success: false,
          error: error.message
        };
        
        await sendLogToContent(`❌ 连接失败: ${url} - ${error.message}`, 'error', { 
          url: url,
          error: error.message,
          subStep: '连接测试失败'
        });
      }
    }
    
    await sendLogToContent('📊 网络连接测试完成', 'info', { 
      results: results,
      subStep: '网络测试完成'
    });
    
    return results;
    
  } catch (error) {
    await sendLogToContent(`💥 网络连接测试失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '网络测试失败'
    });
    return null;
  }
}

// 手动测试网络连接（供用户调用）
async function manualNetworkTest() {
  try {
    await sendLogToContent('🧪 开始手动网络连接测试...', 'info', { subStep: '手动测试开始' });
    
    // 测试基本网络连接
    const networkTest = await testNetworkConnection();
    
    // 测试状态码0诊断
    const diagnosis = await diagnoseStatusCodeZero();
    
    // 测试具体的登录URL
    await sendLogToContent('🔗 测试登录URL连接...', 'info', { subStep: '登录URL测试' });
    
    const loginUrlTest = await testSpecificUrl(EMAIL_CONFIG.loginUrl);
    
    const testResults = {
      timestamp: new Date().toISOString(),
      networkTest: networkTest,
      diagnosis: diagnosis,
      loginUrlTest: loginUrlTest
    };
    
    await sendLogToContent('📊 手动网络测试完成', 'success', { 
      results: testResults,
      subStep: '手动测试完成'
    });
    
    return testResults;
    
  } catch (error) {
    await sendLogToContent(`💥 手动网络测试失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '手动测试失败'
    });
    return null;
  }
}

// 测试特定URL
async function testSpecificUrl(url) {
  try {
    await sendLogToContent(`🔗 测试特定URL: ${url}`, 'info', { 
      url: url,
      subStep: '特定URL测试'
    });
    
    const methods = [
      { name: 'fetch标准', fn: () => fetch(url, { method: 'GET' }) },
      { name: 'fetch no-cors', fn: () => fetch(url, { method: 'GET', mode: 'no-cors' }) },
      { name: 'XMLHttpRequest', fn: () => makeXHRRequest(url, 'GET') }
    ];
    
    const results = {};
    
    for (const method of methods) {
      try {
        const startTime = Date.now();
        const response = await method.fn();
        const endTime = Date.now();
        
        results[method.name] = {
          success: true,
          status: response.status || 'no-cors',
          statusText: response.statusText || 'no-cors mode',
          responseTime: endTime - startTime,
          headers: response.headers ? Object.fromEntries(response.headers.entries()) : 'no-cors'
        };
        
        await sendLogToContent(`✅ ${method.name} 成功: ${response.status || 'no-cors'} (${endTime - startTime}ms)`, 'success', { 
          method: method.name,
          status: response.status || 'no-cors',
          responseTime: endTime - startTime,
          subStep: '方法测试成功'
        });
        
      } catch (error) {
        results[method.name] = {
          success: false,
          error: error.message
        };
        
        await sendLogToContent(`❌ ${method.name} 失败: ${error.message}`, 'error', { 
          method: method.name,
          error: error.message,
          subStep: '方法测试失败'
        });
      }
    }
    
    return results;
    
  } catch (error) {
    await sendLogToContent(`💥 特定URL测试失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '特定URL测试失败'
    });
    return null;
  }
}

// 诊断状态码0问题
async function diagnoseStatusCodeZero() {
  try {
    await sendLogToContent('🔍 开始诊断状态码0问题...', 'info', { subStep: '状态码0诊断' });
    
    const diagnosis = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      connection: null
    };
    
    // 检查网络连接状态
    if ('connection' in navigator) {
      diagnosis.connection = {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      };
    }
    
    // 测试基本网络连接
    const networkTest = await testNetworkConnection();
    diagnosis.networkTest = networkTest;
    
    // 检查扩展权限
    try {
      const permissions = await chrome.permissions.getAll();
      diagnosis.permissions = permissions;
    } catch (permError) {
      diagnosis.permissions = { error: permError.message };
    }
    
    // 检查扩展信息
    try {
      const manifest = chrome.runtime.getManifest();
      diagnosis.manifest = {
        version: manifest.version,
        permissions: manifest.permissions,
        host_permissions: manifest.host_permissions
      };
    } catch (manifestError) {
      diagnosis.manifest = { error: manifestError.message };
    }
    
    await sendLogToContent('📊 状态码0诊断完成', 'info', { 
      diagnosis: diagnosis,
      subStep: '诊断完成'
    });
    
    return diagnosis;
    
  } catch (error) {
    await sendLogToContent(`💥 状态码0诊断失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '诊断失败'
    });
    return null;
  }
}

// 诊断邮箱创建请求问题
async function diagnoseEmailCreationRequest(url, createData) {
  try {
    await sendLogToContent('🔍 开始诊断邮箱创建请求问题...', 'info', { subStep: '邮箱创建诊断' });
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      url: url,
      createDataSize: createData.toString().length,
      createDataPreview: createData.toString().substring(0, 100) + '...',
      tests: {}
    };
    
    // 测试1: 基本连接测试 (HEAD请求)
    try {
      const startTime = Date.now();
      const response = await fetch(url, { method: 'HEAD' });
      const endTime = Date.now();
      
      diagnostics.tests.basicConnection = {
        success: true,
        status: response.status,
        responseTime: endTime - startTime
      };
    } catch (error) {
      diagnostics.tests.basicConnection = {
        success: false,
        error: error.message
      };
    }
    
    // 测试2: GET请求测试
    try {
      const startTime = Date.now();
      const response = await fetch(url, { method: 'GET' });
      const endTime = Date.now();
      
      diagnostics.tests.getRequest = {
        success: true,
        status: response.status,
        responseTime: endTime - startTime,
        contentType: response.headers.get('content-type')
      };
    } catch (error) {
      diagnostics.tests.getRequest = {
        success: false,
        error: error.message
      };
    }
    
    // 测试3: 小数据POST测试
    try {
      const testData = new URLSearchParams();
      testData.append('test', '1');
      
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: testData.toString()
      });
      const endTime = Date.now();
      
      diagnostics.tests.smallPostRequest = {
        success: true,
        status: response.status,
        responseTime: endTime - startTime
      };
    } catch (error) {
      diagnostics.tests.smallPostRequest = {
        success: false,
        error: error.message
      };
    }
    
    // 测试4: 实际创建数据POST测试
    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: createData.toString()
      });
      const endTime = Date.now();
      
      diagnostics.tests.actualCreateRequest = {
        success: true,
        status: response.status,
        responseTime: endTime - startTime,
        responseSize: response.headers.get('content-length') || 'unknown'
      };
    } catch (error) {
      diagnostics.tests.actualCreateRequest = {
        success: false,
        error: error.message
      };
    }
    
    await sendLogToContent('📊 邮箱创建请求诊断完成', 'info', { 
      diagnostics: diagnostics,
      subStep: '诊断完成'
    });
    
    return diagnostics;
    
  } catch (error) {
    await sendLogToContent(`💥 邮箱创建请求诊断失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '诊断失败'
    });
    return null;
  }
}

// 诊断登录请求问题
async function diagnoseLoginRequest(url, loginData) {
  try {
    await sendLogToContent('🔍 开始诊断登录请求问题...', 'info', { subStep: '登录请求诊断' });
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      url: url,
      loginDataSize: loginData.toString().length,
      loginDataPreview: loginData.toString().substring(0, 100) + '...',
      tests: {}
    };
    
    // 测试1: 基本连接测试
    try {
      const startTime = Date.now();
      const response = await fetch(url, { method: 'HEAD' });
      const endTime = Date.now();
      
      diagnostics.tests.basicConnection = {
        success: true,
        status: response.status,
        responseTime: endTime - startTime
      };
    } catch (error) {
      diagnostics.tests.basicConnection = {
        success: false,
        error: error.message
      };
    }
    
    // 测试2: GET请求测试
    try {
      const startTime = Date.now();
      const response = await fetch(url, { method: 'GET' });
      const endTime = Date.now();
      
      diagnostics.tests.getRequest = {
        success: true,
        status: response.status,
        responseTime: endTime - startTime,
        contentType: response.headers.get('content-type')
      };
    } catch (error) {
      diagnostics.tests.getRequest = {
        success: false,
        error: error.message
      };
    }
    
    // 测试3: 小数据POST测试
    try {
      const testData = new URLSearchParams();
      testData.append('test', '1');
      
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: testData.toString()
      });
      const endTime = Date.now();
      
      diagnostics.tests.smallPostRequest = {
        success: true,
        status: response.status,
        responseTime: endTime - startTime
      };
    } catch (error) {
      diagnostics.tests.smallPostRequest = {
        success: false,
        error: error.message
      };
    }
    
    // 测试4: 实际登录数据POST测试
    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: loginData.toString()
      });
      const endTime = Date.now();
      
      diagnostics.tests.actualLoginRequest = {
        success: true,
        status: response.status,
        responseTime: endTime - startTime,
        responseSize: response.headers.get('content-length') || 'unknown'
      };
    } catch (error) {
      diagnostics.tests.actualLoginRequest = {
        success: false,
        error: error.message
      };
    }
    
    await sendLogToContent('📊 登录请求诊断完成', 'info', { 
      diagnostics: diagnostics,
      subStep: '诊断完成'
    });
    
    return diagnostics;
    
  } catch (error) {
    await sendLogToContent(`💥 登录请求诊断失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '诊断失败'
    });
    return null;
  }
}

// 从HTML中提取邮件信息
async function extractEmailsFromHtml(htmlContent) {
  try {
    await sendLogToContent('🔍 开始从HTML中提取邮件信息...', 'info', { subStep: 'HTML邮件提取' });
    
    const emails = [];
    
    // 尝试查找邮件列表的常见模式
    const emailPatterns = [
      // 查找包含邮件主题的元素
      /<div[^>]*class="[^"]*email[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*message[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*mail[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // 查找表格行
      /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
      // 查找列表项
      /<li[^>]*>([\s\S]*?)<\/li>/gi
    ];
    
    for (const pattern of emailPatterns) {
      const matches = htmlContent.match(pattern);
      if (matches && matches.length > 0) {
        await sendLogToContent(`📧 找到 ${matches.length} 个可能的邮件元素`, 'info', { 
          pattern: pattern.toString(),
          matchCount: matches.length,
          subStep: '模式匹配'
        });
        
        for (const match of matches) {
          // 尝试提取主题
          const subjectMatch = match.match(/<[^>]*class="[^"]*subject[^"]*"[^>]*>([^<]+)<\/[^>]*>/i) ||
                              match.match(/<[^>]*>([^<]*验证码[^<]*)<\/[^>]*>/i) ||
                              match.match(/<[^>]*>([^<]*code[^<]*)<\/[^>]*>/i);
          
          if (subjectMatch) {
            const subject = subjectMatch[1].trim();
            await sendLogToContent(`📧 提取到邮件主题: ${subject}`, 'info', { 
              subject: subject,
              subStep: '主题提取'
            });
            
            emails.push({
              subject: subject,
              body: match,
              content: match,
              text: match.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            });
          }
        }
      }
    }
    
    await sendLogToContent(`✅ HTML邮件提取完成，共找到 ${emails.length} 封邮件`, 'success', { 
      emailCount: emails.length,
      subStep: 'HTML提取完成'
    });
    
    return emails;
    
  } catch (error) {
    await sendLogToContent(`❌ HTML邮件提取失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: 'HTML提取失败'
    });
    return [];
  }
}

// 调试登录响应内容
async function debugLoginResponse(response, responseText) {
  try {
    await sendLogToContent('🔍 开始调试登录响应...', 'info', { subStep: '响应调试开始' });
    
    // 记录响应头信息
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
      headers[key] = value;
    }
    
    await sendLogToContent('📋 响应头信息:', 'info', { 
      headers: headers,
      subStep: '响应头分析'
    });
    
    // 分析响应内容
    const contentAnalysis = {
      length: responseText.length,
      hasHtml: responseText.includes('<!DOCTYPE') || responseText.includes('<html'),
      hasLoginForm: responseText.includes('login') || responseText.includes('登录'),
      hasError: responseText.includes('error') || responseText.includes('错误'),
      hasSuccess: responseText.includes('success') || responseText.includes('成功'),
      hasRedirect: responseText.includes('redirect') || responseText.includes('重定向'),
      hasDashboard: responseText.includes('dashboard') || responseText.includes('管理'),
      hasCaptcha: responseText.includes('captcha') || responseText.includes('验证码'),
      hasUsername: responseText.includes('username') || responseText.includes('用户名'),
      hasPassword: responseText.includes('password') || responseText.includes('密码')
    };
    
    await sendLogToContent('📊 响应内容分析:', 'info', { 
      analysis: contentAnalysis,
      subStep: '内容分析'
    });
    
    // 提取关键信息片段
    const keyFragments = [];
    const patterns = [
      /<title[^>]*>([^<]+)<\/title>/i,
      /<h1[^>]*>([^<]+)<\/h1>/i,
      /<h2[^>]*>([^<]+)<\/h2>/i,
      /<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/div>/i,
      /<span[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/span>/i,
      /<div[^>]*class="[^"]*success[^"]*"[^>]*>([^<]+)<\/div>/i,
      /<span[^>]*class="[^"]*success[^"]*"[^>]*>([^<]+)<\/span>/i
    ];
    
    patterns.forEach(pattern => {
      const matches = responseText.match(pattern);
      if (matches) {
        keyFragments.push(matches[1].trim());
      }
    });
    
    if (keyFragments.length > 0) {
      await sendLogToContent('🔑 关键信息片段:', 'info', { 
        fragments: keyFragments,
        subStep: '关键信息提取'
      });
    }
    
    // 记录响应内容预览（前1000字符）
    const preview = responseText.substring(0, 1000);
    await sendLogToContent('📄 响应内容预览:', 'info', { 
      preview: preview,
      subStep: '内容预览'
    });
    
    await sendLogToContent('✅ 响应调试完成', 'success', { subStep: '响应调试完成' });
    
    return {
      headers: headers,
      analysis: contentAnalysis,
      fragments: keyFragments,
      preview: preview
    };
    
  } catch (error) {
    await sendLogToContent(`❌ 响应调试失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '响应调试失败'
    });
    return null;
  }
}

// 检查是否已经登录
async function checkIfAlreadyLoggedIn() {
  try {
    await sendLogToContent('🔍 检查是否已经登录...', 'info', { subStep: '登录状态检查' });
    
    // 尝试访问需要登录的页面 - 使用实际需要访问的页面进行检测
    const protectedPageResponse = await fetch(`${EMAIL_CONFIG.adminUrl}/Users/edit`, {
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    
    if (!protectedPageResponse.ok) {
      await sendLogToContent('❌ 无法访问受保护页面，未登录', 'info', { 
        subStep: '登录状态检查',
        status: protectedPageResponse.status
      });
      return false;
    }
    
    const pageContent = await protectedPageResponse.text();
    
    // 检查是否被重定向到登录页
    if (pageContent.includes('登录') || pageContent.includes('login') || 
        pageContent.includes('用户名') || pageContent.includes('password') ||
        pageContent.includes('立即登录') || pageContent.includes('邮箱管理后台')) {
      await sendLogToContent('❌ 被重定向到登录页，未登录', 'info', { 
        subStep: '登录状态检查',
        reason: '被重定向到登录页'
      });
      return false;
    }
    
    // 检查是否包含邮箱添加表单
    if (pageContent.includes('name="email"') && pageContent.includes('name="password"') && 
        pageContent.includes('name="uname"') && pageContent.includes('保存')) {
      await sendLogToContent('✅ 检测到已登录状态', 'success', { 
        subStep: '登录状态检查',
        reason: '页面包含邮箱添加表单'
      });
      return true;
    }
    
    await sendLogToContent('❌ 页面内容不符合预期，未登录', 'info', { 
      subStep: '登录状态检查',
      reason: '页面内容不符合预期'
    });
    return false;
    
  } catch (error) {
    await sendLogToContent(`⚠️ 登录状态检查出错: ${error.message}`, 'warning', { 
      error: error.message,
      subStep: '登录状态检查错误'
    });
    return false;
  }
}

// 真实的邮箱管理后台登录
async function loginToEmailAdmin() {
  try {
    await sendLogToContent('🔐 开始邮箱管理后台登录流程', 'info', { 
      url: EMAIL_CONFIG.adminUrl,
      timestamp: new Date().toISOString()
    });
    
    // 子步骤1: 检查是否已经登录
    await sendLogToContent('📋 子步骤1: 检查是否已经登录...', 'info', { subStep: '登录状态检查' });
    
    // 首先检查是否已经登录
    const isAlreadyLoggedIn = await checkIfAlreadyLoggedIn();
    if (isAlreadyLoggedIn) {
      await sendLogToContent('✅ 检测到已经登录，跳过登录步骤', 'success', { 
        subStep: '已登录检查',
        reason: '检测到有效的管理会话'
      });
      return {
        success: true,
        sessionId: `existing_session_${Date.now()}`,
        message: '已经登录，无需重复登录'
      };
    }
    
    // 子步骤2: 获取登录页面
    await sendLogToContent('📋 子步骤2: 正在获取登录页面...', 'info', { subStep: '获取登录页面' });
    
    // 🔍 可视化：显示请求头信息
    await showHeadersVisualization(BROWSER_HEADERS, 'GET登录页面');
    await showStepVisualization('获取登录页面', { 
      url: EMAIL_CONFIG.loginUrl,
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    
    let loginPageResponse;
    try {
      loginPageResponse = await fetch(EMAIL_CONFIG.loginUrl, {
        method: 'GET',
        headers: BROWSER_HEADERS
      });
    } catch (fetchError) {
      await sendLogToContent('⚠️ fetch请求失败，尝试使用XMLHttpRequest...', 'warning', { 
        error: fetchError.message,
        subStep: 'fetch失败，使用备选方案'
      });
      
      // 使用XMLHttpRequest作为备选方案
      loginPageResponse = await makeXHRRequest(EMAIL_CONFIG.loginUrl, 'GET');
    }
    
    await sendLogToContent(`📊 登录页面响应: ${loginPageResponse.status} ${loginPageResponse.statusText}`, 'info', { 
      status: loginPageResponse.status,
      statusText: loginPageResponse.statusText
    });
    
    if (!loginPageResponse.ok) {
      throw new Error(`无法访问登录页面: ${loginPageResponse.status} ${loginPageResponse.statusText}`);
    }
    
    const loginPageHtml = await loginPageResponse.text();
    await sendLogToContent(`📄 登录页面HTML长度: ${loginPageHtml.length} 字符`, 'info', { 
      htmlLength: loginPageHtml.length 
    });
    
    // 🔍 调试：显示HTML内容片段
    if (DEBUG_CONFIG.enabled) {
      const htmlDebug = {
        length: loginPageHtml.length,
        title: loginPageHtml.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '未找到标题',
        first200Chars: loginPageHtml.substring(0, 200),
        last200Chars: loginPageHtml.substring(loginPageHtml.length - 200),
        formTags: loginPageHtml.match(/<form[^>]*>/gi) || [],
        inputTags: loginPageHtml.match(/<input[^>]*>/gi) || [],
        hasFormTag: loginPageHtml.includes('<form'),
        hasInputTag: loginPageHtml.includes('<input'),
        hasCaptchaText: loginPageHtml.includes('captcha') || loginPageHtml.includes('验证码'),
        hasLoginText: loginPageHtml.includes('login') || loginPageHtml.includes('登录')
      };
      
      await showStepVisualization('HTML内容调试', htmlDebug);
    }
    
    // 🔍 可视化：显示页面关键内容片段
    const keyContentSnippets = {
      title: loginPageHtml.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '未找到标题',
      hasForm: loginPageHtml.includes('<form'),
      formCount: (loginPageHtml.match(/<form/gi) || []).length,
      inputCount: (loginPageHtml.match(/<input/gi) || []).length,
      hasCaptcha: loginPageHtml.includes('captcha') || loginPageHtml.includes('验证码'),
      hasLogin: loginPageHtml.includes('login') || loginPageHtml.includes('登录'),
      hasUsername: loginPageHtml.includes('username') || loginPageHtml.includes('用户名'),
      hasPassword: loginPageHtml.includes('password') || loginPageHtml.includes('密码')
    };
    
    // 🔍 增强：更详细的页面内容分析
    const enhancedAnalysis = {
      // 基础检测
      basic: keyContentSnippets,
      
      // 详细表单检测
      forms: {
        formTags: loginPageHtml.match(/<form[^>]*>/gi) || [],
        formCount: (loginPageHtml.match(/<form/gi) || []).length,
        formStart: loginPageHtml.indexOf('<form'),
        formEnd: loginPageHtml.lastIndexOf('</form>')
      },
      
      // 详细输入字段检测
      inputs: {
        inputTags: loginPageHtml.match(/<input[^>]*>/gi) || [],
        inputCount: (loginPageHtml.match(/<input/gi) || []).length,
        usernameInputs: loginPageHtml.match(/<input[^>]*name[^>]*username[^>]*>/gi) || [],
        passwordInputs: loginPageHtml.match(/<input[^>]*name[^>]*password[^>]*>/gi) || [],
        captchaInputs: loginPageHtml.match(/<input[^>]*name[^>]*captcha[^>]*>/gi) || []
      },
      
      // 验证码相关检测
      captcha: {
        hasCaptchaText: loginPageHtml.includes('captcha') || loginPageHtml.includes('验证码'),
        hasCaptchaImage: loginPageHtml.includes('<img') && (loginPageHtml.includes('captcha') || loginPageHtml.includes('验证码')),
        captchaPatterns: [
          { pattern: 'captcha', found: loginPageHtml.includes('captcha'), count: (loginPageHtml.match(/captcha/gi) || []).length },
          { pattern: '验证码', found: loginPageHtml.includes('验证码'), count: (loginPageHtml.match(/验证码/gi) || []).length },
          { pattern: 'code', found: loginPageHtml.includes('code'), count: (loginPageHtml.match(/code/gi) || []).length }
        ]
      },
      
      // 页面结构检测
      structure: {
        hasLoginForm: loginPageHtml.includes('login') && loginPageHtml.includes('<form'),
        hasUsernameField: loginPageHtml.includes('username') || loginPageHtml.includes('用户名'),
        hasPasswordField: loginPageHtml.includes('password') || loginPageHtml.includes('密码'),
        hasSubmitButton: loginPageHtml.includes('submit') || loginPageHtml.includes('登录') || loginPageHtml.includes('login')
      }
    };
    
    // 🔍 调试：显示原始HTML片段
    const htmlSnippets = {
      titleSection: loginPageHtml.substring(0, 200),
      formSection: loginPageHtml.includes('<form') ? 
        loginPageHtml.substring(loginPageHtml.indexOf('<form'), loginPageHtml.indexOf('<form') + 500) : '未找到form标签',
      inputSection: loginPageHtml.includes('<input') ? 
        loginPageHtml.substring(loginPageHtml.indexOf('<input'), loginPageHtml.indexOf('<input') + 300) : '未找到input标签'
    };
    
    await showPageAnalysisVisualization(keyContentSnippets, '页面关键内容');
    
    // 🔍 显示增强的页面分析结果
    await showPageAnalysisVisualization(enhancedAnalysis, '增强页面分析');
    
    // 🔍 显示HTML片段用于调试
    await showStepVisualization('HTML片段分析', { 
      htmlLength: loginPageHtml.length,
      htmlSnippets,
      enhancedAnalysis
    });
    
    // 子步骤2: 分析页面内容
    await sendLogToContent('🔍 子步骤2: 正在分析页面内容...', 'info', { subStep: '分析页面内容' });
    
    // 🔍 可视化：显示页面内容分析详情
    const loginFormPatterns = ['login', 'username', 'password', 'form'];
    const verificationPatterns = ['verification', '验证码', 'code', 'captcha', 'img'];
    
    const loginFormMatches = loginFormPatterns.map(pattern => ({
      pattern,
      found: loginPageHtml.includes(pattern),
      count: (loginPageHtml.match(new RegExp(pattern, 'gi')) || []).length
    }));
    
    const verificationMatches = verificationPatterns.map(pattern => ({
      pattern,
      found: loginPageHtml.includes(pattern),
      count: (loginPageHtml.match(new RegExp(pattern, 'gi')) || []).length
    }));
    
    await sendLogToContent('🔍 页面内容分析详情:', 'info', { 
      loginFormAnalysis: loginFormMatches,
      verificationAnalysis: verificationMatches,
      subStep: '详细分析'
    });
    
    // 🔍 使用增强的检测逻辑
    const hasLoginForm = enhancedAnalysis.structure.hasLoginForm || 
                         enhancedAnalysis.forms.formCount > 0 || 
                         enhancedAnalysis.inputs.inputCount > 0;
    
    const hasVerificationForm = enhancedAnalysis.captcha.hasCaptchaText || 
                                enhancedAnalysis.captcha.hasCaptchaImage || 
                                enhancedAnalysis.inputs.captchaInputs.length > 0;
    
    // 🔍 调试：显示检测结果
    if (DEBUG_CONFIG.enabled) {
      await showStepVisualization('页面检测结果', {
        enhancedAnalysis,
        hasLoginForm,
        hasVerificationForm,
        detectionMethod: 'enhanced'
      });
    }
    
    await sendLogToContent(`📝 页面分析结果: 登录表单=${hasLoginForm}, 验证码表单=${hasVerificationForm}`, 'info', { 
      hasLoginForm,
      hasVerificationForm
    });
    
    // 🔍 新增：智能会话检测
    const sessionStatus = await detectExistingSession(loginPageHtml);
    if (sessionStatus.isLoggedIn) {
      await sendLogToContent(`🎉 检测到管理员已登录，跳过登录流程`, 'success', { 
        sessionStatus: sessionStatus,
        reason: '检测到有效会话',
        subStep: '会话检测'
      });
      
      // 返回成功状态，模拟登录成功
      return {
        success: true,
        sessionId: `cached_session_${Date.now()}`,
        cookies: null,
        message: '管理员已登录（会话缓存有效）',
        fromCache: true,
        sessionInfo: sessionStatus
      };
    }
    
    // 🔍 使用增强的验证码检测逻辑
    const hasCaptchaImage = enhancedAnalysis.captcha.hasCaptchaImage || 
                            enhancedAnalysis.captcha.captchaPatterns.some(p => p.found);
    
    const hasCaptchaField = enhancedAnalysis.inputs.captchaInputs.length > 0 || 
                            loginPageHtml.includes('name="captcha"') || 
                            loginPageHtml.includes('name="code"') || 
                            loginPageHtml.includes('name="验证码"');
    
    await sendLogToContent(`🔍 详细验证码检测: 图片=${hasCaptchaImage}, 字段=${hasCaptchaField}`, 'info', { 
      hasCaptchaImage,
      hasCaptchaField,
      subStep: '验证码详细检测'
    });
    
    // 🔍 可视化：详细验证码检测结果
    const captchaDetectionDetails = {
      patterns: {
        'captcha': {
          found: loginPageHtml.includes('captcha'),
          count: (loginPageHtml.match(/captcha/gi) || []).length,
          positions: []
        },
        '验证码': {
          found: loginPageHtml.includes('验证码'),
          count: (loginPageHtml.match(/验证码/gi) || []).length,
          positions: []
        },
        'img': {
          found: loginPageHtml.includes('img'),
          count: (loginPageHtml.match(/<img/gi) || []).length,
          positions: []
        }
      },
      formFields: {
        'name="captcha"': loginPageHtml.includes('name="captcha"'),
        'name="code"': loginPageHtml.includes('name="code"'),
        'name="验证码"': loginPageHtml.includes('name="验证码"')
      }
    };
    
    await sendLogToContent('🔍 验证码检测详细分析:', 'info', { 
      captchaDetectionDetails,
      subStep: '验证码详细分析'
    });
    
    // 检查是否需要验证码 - 更宽松的条件
    if (hasVerificationForm || hasCaptchaImage || hasCaptchaField) {
      await sendLogToContent('🖼️ 检测到需要验证码，使用验证码登录流程...', 'info', { subStep: '验证码登录流程' });
      
      // 使用我们测试成功的验证码登录逻辑
      const captchaLoginResult = await loginWithCaptcha(loginPageHtml);
      
      // 🔍 调试：显示验证码登录结果
      if (DEBUG_CONFIG.enabled) {
        await showStepVisualization('验证码登录结果', {
          result: captchaLoginResult,
          success: captchaLoginResult === true,
          timestamp: new Date().toISOString()
        });
      }
      
      // 如果验证码登录成功，直接返回成功
      if (captchaLoginResult === true) {
        await sendLogToContent('🎉 验证码登录成功，步骤1完成！', 'success', { 
          step: 1,
          stepName: '登录邮箱管理后台',
          status: 'success'
        });
        
        // 返回符合主流程期望的格式
        return {
          success: true,
          sessionId: `session_${Date.now()}`,
          cookies: null, // 验证码登录可能没有额外的cookies
          message: '邮箱管理后台登录成功（验证码）'
        };
      } else {
        throw new Error('验证码登录失败：返回结果异常');
      }
    }
    
    // 尝试提取CSRF token（如果存在）
    const csrfMatch = loginPageHtml.match(/name="csrf_token" value="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    
    if (csrfToken) {
      await sendLogToContent(`🔑 发现CSRF token: ${csrfToken.substring(0, 10)}...`, 'info', { 
        hasCsrfToken: true,
        csrfTokenLength: csrfToken.length 
      });
    } else {
      await sendLogToContent('ℹ️ 未发现CSRF token', 'info', { hasCsrfToken: false });
    }
    
    // 子步骤3: 构建登录数据
    await sendLogToContent('📝 子步骤3: 正在构建登录数据...', 'info', { subStep: '构建登录数据' });
    
    const loginData = new URLSearchParams();
    loginData.append('username', EMAIL_CONFIG.adminCredentials.username);
    loginData.append('password', EMAIL_CONFIG.adminCredentials.password);
    if (csrfToken) {
      loginData.append('csrf_token', csrfToken);
    }
    
    await sendLogToContent(`📋 登录数据已构建: 用户名=${EMAIL_CONFIG.adminCredentials.username}, 密码长度=${EMAIL_CONFIG.adminCredentials.password.length}, CSRF=${!!csrfToken}`, 'info', { 
      username: EMAIL_CONFIG.adminCredentials.username,
      passwordLength: EMAIL_CONFIG.adminCredentials.password.length,
      hasCsrfToken: !!csrfToken
    });
    
    // 子步骤4: 提交登录请求（带重试和详细诊断）
    await sendLogToContent('🚀 子步骤4: 正在提交登录请求...', 'info', { subStep: '提交登录请求' });
    
    // 🔍 可视化：验证BROWSER_HEADERS配置
    await showHeadersVisualization(BROWSER_HEADERS, 'BROWSER_HEADERS配置');
    await showStepVisualization('请求头配置验证', { 
      browserHeadersConfig: BROWSER_HEADERS,
      headerCount: Object.keys(BROWSER_HEADERS).length
    });
    
    let loginResponse;
    let lastError = null;
    
    // 尝试多种请求配置
    const requestConfigs = [
      {
        name: '标准配置',
        options: {
          method: 'POST',
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': EMAIL_CONFIG.loginUrl
          },
          body: loginData.toString(),
          redirect: 'manual'
        }
      },
      {
        name: '简化配置',
        options: {
          method: 'POST',
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: loginData.toString(),
          redirect: 'manual'
        }
      },
      {
        name: '带超时配置',
        options: {
          method: 'POST',
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: loginData.toString(),
          redirect: 'manual'
        }
      },
      {
        name: '重试配置',
        options: {
          method: 'POST',
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: loginData.toString(),
          redirect: 'manual'
        }
      }
    ];
    
    for (let i = 0; i < requestConfigs.length; i++) {
      const config = requestConfigs[i];
      try {
        await sendLogToContent(`🔄 尝试配置 ${i + 1}/${requestConfigs.length}: ${config.name}`, 'info', { 
          configName: config.name,
          attempt: i + 1,
          totalAttempts: requestConfigs.length
        });
        
        // 新增：添加请求超时和中断检测
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        try {
          // 新增：详细记录发送的请求数据
          await sendLogToContent(`📤 发送登录请求: ${EMAIL_CONFIG.loginUrl}`, 'info', { 
            configName: config.name,
            url: EMAIL_CONFIG.loginUrl,
            method: 'POST',
            headers: config.options.headers,
            body: loginData.toString(),
            subStep: '请求发送'
          });
          
          // 🔍 可视化：显示实际发送的请求头详情
          await sendLogToContent('🔍 实际发送的请求头:', 'info', { 
            actualHeaders: config.options.headers,
            headerCount: Object.keys(config.options.headers).length,
            subStep: '请求头详情'
          });
          
          loginResponse = await fetch(EMAIL_CONFIG.loginUrl, {
            ...config.options,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId); // 清除超时
          
          await sendLogToContent(`✅ 配置 ${config.name} 成功`, 'success', { 
            configName: config.name,
            status: loginResponse.status,
            statusText: loginResponse.statusText,
            responseHeaders: Object.fromEntries(loginResponse.headers.entries())
          });
          
          // 🔍 可视化：请求头对比分析
          const expectedHeaders = { ...BROWSER_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' };
          const actualHeaders = config.options.headers;
          
          const headerComparison = Object.keys(expectedHeaders).map(key => ({
            header: key,
            expected: expectedHeaders[key],
            actual: actualHeaders[key],
            match: expectedHeaders[key] === actualHeaders[key],
            status: expectedHeaders[key] === actualHeaders[key] ? '✅' : '❌'
          }));
          
          await showStepVisualization('请求头对比分析', { 
            headerComparison,
            matchCount: headerComparison.filter(h => h.match).length,
            totalCount: headerComparison.length,
            expectedHeaders,
            actualHeaders
          });
          
          break; // 成功则跳出循环
          
        } catch (fetchError) {
          clearTimeout(timeoutId); // 清除超时
          
          // 特殊处理AbortError（超时或中断）
          if (fetchError.name === 'AbortError') {
            await sendLogToContent(`⏰ 配置 ${config.name} 超时或被中断`, 'warning', { 
              configName: config.name,
              error: fetchError.message,
              attempt: i + 1,
              subStep: '请求超时'
            });
          } else {
            throw fetchError; // 重新抛出其他错误
          }
        }
        
      } catch (error) {
        lastError = error;
        
        // 新增：特殊处理HEAD请求失败但其他请求成功的情况
        if (error.message.includes('Failed to fetch') && 
            config.name === '标准配置' && 
            i === 0) {
          await sendLogToContent(`⚠️ 配置 ${config.name} 失败: ${error.message}，但继续尝试其他配置`, 'warning', { 
            configName: config.name,
            error: error.message,
            attempt: i + 1,
            subStep: 'HEAD异常处理'
          });
        } else if (error.name === 'AbortError') {
          // 新增：特殊处理超时和中断错误
          await sendLogToContent(`⏰ 配置 ${config.name} 超时或被中断: ${error.message}`, 'warning', { 
            configName: config.name,
            error: error.message,
            attempt: i + 1,
            subStep: '请求超时处理'
          });
        } else {
          await sendLogToContent(`❌ 配置 ${config.name} 失败: ${error.message}`, 'error', { 
            configName: config.name,
            error: error.message,
            attempt: i + 1
          });
        }
        
        if (i === requestConfigs.length - 1) {
          // 所有配置都失败
          throw new Error(`所有登录请求配置都失败。最后错误: ${error.message}`);
        }
        
        // 等待1秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    await sendLogToContent(`📊 登录响应: ${loginResponse.status} ${loginResponse.statusText}`, 'info', { 
      status: loginResponse.status,
      statusText: loginResponse.statusText
    });
    
    // 新增：详细记录响应头信息
    const responseHeaders = {};
    loginResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    await sendLogToContent(`📋 响应头信息: ${JSON.stringify(responseHeaders, null, 2)}`, 'info', { 
      headers: responseHeaders,
      subStep: '响应头分析'
    });
    
    // 子步骤5: 分析登录响应
    await sendLogToContent('🔍 子步骤5: 正在分析登录响应...', 'info', { subStep: '分析登录响应' });
    
    // 检查登录结果
    const cookies = loginResponse.headers.get('set-cookie');
    const location = loginResponse.headers.get('location');
    
    if (cookies) {
      await sendLogToContent(`🍪 收到Cookie: ${cookies.substring(0, 50)}...`, 'info', { 
        hasCookies: true,
        cookieLength: cookies.length 
      });
    } else {
      await sendLogToContent('ℹ️ 未收到Cookie', 'info', { hasCookies: false });
    }
    
    if (location) {
      await sendLogToContent(`📍 重定向位置: ${location}`, 'info', { hasLocation: true, location });
    } else {
      await sendLogToContent('ℹ️ 无重定向', 'info', { hasLocation: false });
    }
    
    // 子步骤6: 处理登录结果（增强版重定向处理）
    if (loginResponse.status === 302 && location) {
      await sendLogToContent('✅ 检测到登录重定向', 'success', { 
        redirectUrl: location,
        subStep: '重定向处理开始'
      });
      
      // 解析绝对URL
      const fullRedirectUrl = new URL(location, EMAIL_CONFIG.loginUrl).href;
      await sendLogToContent(`🔗 完整重定向URL: ${fullRedirectUrl}`, 'info', { 
        fullUrl: fullRedirectUrl,
        subStep: 'URL解析'
      });
      
      // 构建重定向请求头
      const redirectHeaders = {
        ...BROWSER_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      };
      
      // 如果有Cookie，添加到请求头
      if (cookies) {
        redirectHeaders['Cookie'] = cookies;
        await sendLogToContent('🍪 已添加Cookie到重定向请求', 'info', { 
          hasCookies: true,
          subStep: 'Cookie添加'
        });
      }
      
      // 跟随重定向
      await sendLogToContent('🔄 正在跟随重定向...', 'info', { subStep: '重定向跟随' });
      
      let finalResponse;
      try {
        finalResponse = await fetch(fullRedirectUrl, {
          method: 'GET',
          headers: redirectHeaders,
          redirect: 'manual'
        });
        
        await sendLogToContent(`📊 重定向响应: ${finalResponse.status} ${finalResponse.statusText}`, 'info', { 
          status: finalResponse.status,
          statusText: finalResponse.statusText,
          subStep: '重定向完成'
        });
        
        // 检查重定向后的页面内容
        const finalContent = await finalResponse.text();
        await sendLogToContent(`📄 最终页面长度: ${finalContent.length} 字符`, 'info', { 
          contentLength: finalContent.length,
          subStep: '内容分析'
        });
        
        // 检查是否成功登录到管理界面
        const successIndicators = [
          'dashboard', 'logout', 'admin', 'index', 'center', 'user', 'mail',
          '欢迎', 'welcome', '登录成功', 'login success', '管理', 'management',
          '邮箱', 'email', '用户', 'user', '设置', 'setting'
        ];
        
        // 新增：检查失败标识
        const failureIndicators = [
          '错误', '失败', 'invalid', 'incorrect', '验证码错误',
          'username or password error', 'captcha error', 'login failed',
          '用户名或密码错误', '验证码错误', '登录失败'
        ];
        
        const hasSuccessIndicator = successIndicators.some(indicator => 
          finalContent.toLowerCase().includes(indicator.toLowerCase())
        );
        
        const hasFailureIndicator = failureIndicators.some(indicator => 
          finalContent.toLowerCase().includes(indicator.toLowerCase())
        );
        
        if (hasFailureIndicator) {
          const foundFailures = failureIndicators.filter(indicator => 
            finalContent.toLowerCase().includes(indicator.toLowerCase())
          );
          await sendLogToContent('❌ 重定向后页面包含失败标识', 'error', {
            foundFailures: foundFailures,
            subStep: '失败检测'
          });
          throw new Error(`重定向后页面包含失败标识: ${foundFailures.join(', ')}`);
        }
        
        if (hasSuccessIndicator || finalResponse.status === 200) {
          await sendLogToContent('🎉 重定向登录成功！', 'success', { 
            indicators: successIndicators.filter(indicator => 
              finalContent.toLowerCase().includes(indicator.toLowerCase())
            ),
            subStep: '登录成功'
          });
          
          const sessionId = `session_${Date.now()}`;
          return {
            success: true,
            sessionId: sessionId,
            cookies: cookies,
            message: '邮箱管理后台登录成功（重定向）',
            redirectUrl: location,
            finalStatus: finalResponse.status
          };
        } else {
          throw new Error('重定向后页面不包含成功登录标识');
        }
        
      } catch (redirectError) {
        await sendLogToContent(`❌ 重定向处理失败: ${redirectError.message}`, 'error', { 
          error: redirectError.message,
          subStep: '重定向失败'
        });
        throw new Error(`重定向处理失败: ${redirectError.message}`);
      }
      
    } else if (loginResponse.status === 200) {
      await sendLogToContent('📋 登录响应状态码200，正在分析内容...', 'info', { subStep: '分析响应内容' });
      
      // 检查响应内容，看是否有错误信息或需要验证码
      const responseText = await loginResponse.text();
      
      await sendLogToContent(`📄 响应内容长度: ${responseText.length} 字符`, 'info', { 
        responseLength: responseText.length 
      });
      
      // 新增：详细记录响应内容（前500字符）
      await sendLogToContent(`📄 登录响应内容 (${responseText.length}字符): ${responseText.substring(0, 500)}`, 'info', { 
        contentPreview: responseText.substring(0, 500),
        subStep: '详细内容分析'
      });
      
      // 新增：检查响应内容是否包含错误信息
      const errorIndicators = [
        '错误', '失败', 'invalid', 'incorrect', '验证码错误',
        'username or password error', 'captcha error', 'login failed',
        '用户名或密码错误', '验证码错误', '登录失败'
      ];
      
      const hasError = errorIndicators.some(indicator => 
        responseText.toLowerCase().includes(indicator.toLowerCase())
      );
      
      if (hasError) {
        const foundErrors = errorIndicators.filter(indicator => 
          responseText.toLowerCase().includes(indicator.toLowerCase())
        );
        await sendLogToContent('❌ 登录响应包含错误信息', 'error', {
          foundErrors: foundErrors,
          subStep: '内容错误检测'
        });
        throw new Error(`登录失败: 页面包含错误标识 - ${foundErrors.join(', ')}`);
      }
      
      // 检查是否需要验证码
      if (responseText.includes('verification') || responseText.includes('验证码') || responseText.includes('code')) {
        await sendLogToContent('🔐 检测到需要验证码登录！', 'warning', { 
          responseLength: responseText.length,
          hasVerification: true,
          subStep: '验证码检测'
        });
        
        // 调用验证码处理函数，传递已读取的响应内容
        return await handleAdminVerificationCode(responseText, cookies);
        
      } else {
        // 检查是否已经登录成功（可能没有重定向）
        const successIndicators = [
          'dashboard', 'logout', 'admin', 'index', 'center', 'user', 'mail',
          '欢迎', 'welcome', '登录成功', 'login success', '管理', 'management',
          '邮箱', 'email', '用户', 'user', '设置', 'setting'
        ];
        
        const hasSuccessIndicator = successIndicators.some(indicator => 
          responseText.toLowerCase().includes(indicator.toLowerCase())
        );
        
        if (hasSuccessIndicator) {
          await sendLogToContent('✅ 检测到已登录状态', 'success', { 
            subStep: '状态检测',
            isLoggedIn: true,
            foundIndicators: successIndicators.filter(indicator => 
              responseText.toLowerCase().includes(indicator.toLowerCase())
            )
          });
          const sessionId = `session_${Date.now()}`;
          return {
            success: true,
            sessionId: sessionId,
            cookies: cookies,
            message: '邮箱管理后台已登录'
          };
        } else {
          // 新增：更详细的失败分析
          await sendLogToContent('⚠️ 响应内容分析：未找到成功标识，也未找到错误标识', 'warning', { 
            subStep: '状态判断',
            responsePreview: responseText.substring(0, 500),
            responseLength: responseText.length,
            searchedIndicators: successIndicators
          });
          
          // 检查是否仍然在登录页面
          const stillOnLoginPage = responseText.includes('login') || 
                                  responseText.includes('username') || 
                                  responseText.includes('password') ||
                                  responseText.includes('登录') ||
                                  responseText.includes('用户名') ||
                                  responseText.includes('密码');
          
          if (stillOnLoginPage) {
            await sendLogToContent('❌ 仍然在登录页面，登录可能失败', 'error', {
              subStep: '页面状态确认',
              stillOnLoginPage: true
            });
            throw new Error('登录失败：仍然在登录页面，可能是凭据错误或服务器问题');
          } else {
            await sendLogToContent('❌ 页面内容异常，无法确定登录状态', 'error', {
              subStep: '页面状态确认',
              stillOnLoginPage: false,
              responsePreview: responseText.substring(0, 500)
            });
            throw new Error('登录失败：页面内容异常，无法确定登录状态');
          }
        }
      }
    } else if (loginResponse.status === 0) {
      // 新增：特殊处理状态码0（网络中断或超时）
      await sendLogToContent(`🚨 检测到状态码0（网络中断或超时），尝试特殊处理`, 'error', { 
        subStep: '状态码0处理',
        statusCode: loginResponse.status,
        possibleCauses: [
          '网络中断', 
          '请求超时', 
          '浏览器限制', 
          'CORS问题',
          '管理员已登录（会话缓存有效）',
          '页面需要刷新以清除缓存'
        ]
      });
      
      // 🔍 新增：检查是否可能是会话缓存问题
      await sendLogToContent('🔍 检查是否可能是会话缓存问题...', 'info', { 
        subStep: '会话缓存检查'
      });
      
      try {
        // 尝试直接访问管理后台，检查是否已经登录
        const adminCheckResponse = await fetch(EMAIL_CONFIG.adminUrl, {
          method: 'GET',
          headers: BROWSER_HEADERS
        });
        
        if (adminCheckResponse.ok) {
          const adminPageHtml = await adminCheckResponse.text();
          const sessionStatus = await detectExistingSession(adminPageHtml);
          
          if (sessionStatus.isLoggedIn) {
            await sendLogToContent('🎉 检测到管理员已登录！状态码0可能是会话缓存问题', 'success', { 
              sessionStatus: sessionStatus,
              subStep: '会话检测成功',
              suggestion: '建议刷新页面或重新启动流程'
            });
            
            // 返回成功状态，避免重复登录
            return {
              success: true,
              sessionId: `detected_session_${Date.now()}`,
              cookies: null,
              message: '管理员已登录（检测到有效会话）',
              fromDetection: true,
              sessionInfo: sessionStatus
            };
          }
        }
      } catch (sessionCheckError) {
        await sendLogToContent('⚠️ 会话检测失败，继续原有流程', 'warning', { 
          error: sessionCheckError.message,
          subStep: '会话检测失败'
        });
      }
      
      try {
        // 尝试使用GET请求验证服务器状态
        await sendLogToContent('🔄 尝试使用GET请求验证服务器状态...', 'info', { 
          subStep: '服务器状态验证'
        });
        
        const serverCheckResponse = await fetch(EMAIL_CONFIG.adminUrl, {
          method: 'GET',
          headers: BROWSER_HEADERS
        });
        
        if (serverCheckResponse.ok) {
          await sendLogToContent('✅ 服务器状态正常，可能是登录请求问题', 'info', { 
            subStep: '服务器状态确认',
            serverStatus: 'normal'
          });
          
          // 尝试严格的登录状态验证
          const sessionValid = await verifySession(`temp_session_${Date.now()}`);
          if (sessionValid) {
            await sendLogToContent('✅ 登录状态验证成功', 'success', { 
              subStep: '登录状态验证成功'
            });
            return {
              success: true,
              sessionId: `temp_session_${Date.now()}`,
              cookies: cookies,
              message: '邮箱管理后台登录成功（通过严格验证）'
            };
          } else {
            throw new Error('登录失败：状态码0，登录状态验证失败');
          }
        } else {
          throw new Error(`登录失败：状态码0，服务器状态异常（${serverCheckResponse.status}）`);
        }
        
      } catch (serverCheckError) {
        throw new Error(`登录请求失败: 状态码0，服务器检查失败: ${serverCheckError.message}`);
      }
      
    } else {
      // 新增：对于其他状态码，尝试会话验证
      await sendLogToContent(`⚠️ 登录响应状态码异常: ${loginResponse.status}，尝试会话验证`, 'warning', { 
        subStep: '异常状态码处理',
        statusCode: loginResponse.status
      });
      
      try {
        // 尝试严格的登录状态验证
        const sessionValid = await verifySession(`temp_session_${Date.now()}`);
        if (sessionValid) {
          await sendLogToContent('✅ 登录状态验证成功', 'success', { 
            subStep: '登录状态验证成功'
          });
          return {
            success: true,
            sessionId: `temp_session_${Date.now()}`,
            cookies: cookies,
            message: '邮箱管理后台登录成功（通过严格验证）'
          };
        } else {
          throw new Error(`登录失败：状态码 ${loginResponse.status}，登录状态验证失败`);
        }
      } catch (sessionError) {
        throw new Error(`登录请求失败: ${loginResponse.status} ${loginResponse.statusText}，登录状态验证失败: ${sessionError.message}`);
      }
    }
    
  } catch (error) {
    // 🔍 调试模式：显示步骤总结
    if (DEBUG_CONFIG.enabled) {
      await showStepVisualization('登录流程总结', {
        step: '登录邮箱管理后台',
        status: '失败',
        error: error.message,
        timestamp: new Date().toISOString(),
        debugMode: DEBUG_CONFIG
      });
      
      // 显示调试汇总
      await showDebugSummary('登录邮箱管理后台', '失败', {
        error: error.message,
        stepProgress: stepProgress,
        timestamp: new Date().toISOString()
      });
    }
    
    // 运行专门的登录请求诊断
    let diagnosticInfo = '';
    let loginDiagnostics = null;
    
    try {
      await sendLogToContent('🔍 检测到登录失败，正在运行专门诊断...', 'warning', { 
        errorType: 'login',
        subStep: '登录诊断开始'
      });
      
      // 重新构建登录数据用于诊断
      const diagnosticLoginData = new URLSearchParams();
      diagnosticLoginData.append('username', EMAIL_CONFIG.adminCredentials.username);
      diagnosticLoginData.append('password', EMAIL_CONFIG.adminCredentials.password);
      
      loginDiagnostics = await diagnoseLoginRequest(EMAIL_CONFIG.loginUrl, diagnosticLoginData);
      
      if (loginDiagnostics) {
        diagnosticInfo = `\n登录请求诊断: ${JSON.stringify(loginDiagnostics, null, 2)}`;
      }
    } catch (diagnosticError) {
      diagnosticInfo = `\n登录诊断失败: ${diagnosticError.message}`;
    }
    
    // 如果是网络相关错误，也运行通用诊断
    if (error.message.includes('0') || error.message.includes('fetch') || error.message.includes('network')) {
      try {
        const generalDiagnosis = await diagnoseStatusCodeZero();
        if (generalDiagnosis) {
          diagnosticInfo += `\n通用诊断信息: ${JSON.stringify(generalDiagnosis, null, 2)}`;
          
          // 新增：特殊处理HEAD请求失败但其他请求成功的情况
          if (generalDiagnosis.tests && 
              generalDiagnosis.tests.basicConnection && 
              !generalDiagnosis.tests.basicConnection.success &&
              generalDiagnosis.tests.getRequest && 
              generalDiagnosis.tests.getRequest.success &&
              generalDiagnosis.tests.smallPostRequest && 
              generalDiagnosis.tests.smallPostRequest.success) {
            
            await sendLogToContent('⚠️ 检测到HEAD请求失败但GET/POST成功，这可能是服务器配置问题', 'warning', {
              subStep: 'HEAD异常分析',
              headFailed: true,
              getPostSuccess: true
            });
            
            diagnosticInfo += `\n注意: HEAD请求失败但GET/POST成功，可能是服务器不支持HEAD方法`;
          }
        }
      } catch (generalDiagnosticError) {
        diagnosticInfo += `\n通用诊断失败: ${generalDiagnosticError.message}`;
      }
    }
    
    const fullErrorMessage = `邮箱管理后台登录失败: ${error.message}${diagnosticInfo}`;
    
    await sendLogToContent(`💥 ${fullErrorMessage}`, 'error', { 
      error: error.message,
      timestamp: new Date().toISOString(),
      step: '登录失败',
      hasLoginDiagnostics: !!loginDiagnostics,
      hasGeneralDiagnostics: diagnosticInfo.includes('通用诊断信息')
    });
    
    return {
      success: false,
      error: fullErrorMessage,
      diagnostics: {
        login: loginDiagnostics,
        general: diagnosticInfo.includes('通用诊断信息') ? '已包含在错误信息中' : null
      }
    };
  }
}

// 处理邮箱管理后台验证码登录
async function handleAdminVerificationCode(responseText, cookies) {
  try {
    await sendLogToContent('🔐 开始处理验证码登录流程', 'info', { subStep: '验证码处理开始' });
    
    await sendLogToContent(`📄 验证码页面内容长度: ${responseText.length} 字符`, 'info', { 
      responseLength: responseText.length 
    });
    
    // 子步骤1: 查找验证码输入框
    await sendLogToContent('🔍 子步骤1: 正在查找验证码输入框...', 'info', { subStep: '查找验证码字段' });
    
    // 根据实际HTML结构查找验证码字段
    const verificationFieldMatch = responseText.match(/name="([^"]*captcha[^"]*)"|name="([^"]*verification[^"]*)"|name="([^"]*code[^"]*)"|name="([^"]*otp[^"]*)"/);
    const verificationFieldName = verificationFieldMatch ? 
      (verificationFieldMatch[1] || verificationFieldMatch[2] || verificationFieldMatch[3] || verificationFieldMatch[4]) : 'captcha';
    
    if (verificationFieldMatch) {
      await sendLogToContent(`✅ 找到验证码字段: ${verificationFieldName}`, 'success', { 
        verificationFieldName,
        subStep: '字段查找完成'
      });
    } else {
      await sendLogToContent('⚠️ 未找到验证码字段，使用默认名称: captcha', 'warning', { 
        verificationFieldName: 'captcha',
        subStep: '字段查找完成'
      });
    }
    
    // 子步骤2: 分析页面结构
    await sendLogToContent('🔍 子步骤2: 正在分析页面结构...', 'info', { subStep: '页面结构分析' });
    
    const hasForm = responseText.includes('<form') || responseText.includes('form');
    const hasSubmitButton = responseText.includes('submit') || responseText.includes('button') || responseText.includes('input[type="submit"]');
    const hasVerificationText = responseText.includes('verification') || responseText.includes('验证码') || responseText.includes('code');
    
    await sendLogToContent(`📝 页面结构分析: 表单=${hasForm}, 提交按钮=${hasVerificationText}, 验证码文本=${hasVerificationText}`, 'info', { 
      hasForm,
      hasSubmitButton,
      hasVerificationText,
      subStep: '结构分析完成'
    });
    
    // 子步骤3: 检查自动验证码配置
    await sendLogToContent('🔍 子步骤3: 检查自动验证码配置...', 'info', { subStep: '配置检查' });
    
    if (VERIFICATION_CONFIG.autoGetVerificationCode) {
      await sendLogToContent('🔄 自动验证码已启用，开始识别图片验证码...', 'info', { 
        autoGetEnabled: true,
        subStep: '自动识别开始'
      });
      
      // 尝试自动识别图片验证码
      const verificationResult = await autoRecognizeImageVerification(responseText);
      if (verificationResult.success) {
        await sendLogToContent(`✅ 图片验证码识别成功: ${verificationResult.code}`, 'success', { 
          code: verificationResult.code,
          subStep: '验证码识别完成'
        });
        
        // 子步骤4: 使用识别到的验证码完成登录
        await sendLogToContent('🔐 子步骤4: 正在使用验证码完成登录...', 'info', { subStep: '验证码登录' });
        
        const finalLoginResult = await completeVerificationLogin(verificationResult.code, verificationFieldName);
        if (finalLoginResult.success) {
          await sendLogToContent('🎉 验证码登录成功！', 'success', { subStep: '登录完成' });
          return finalLoginResult;
        } else {
          throw new Error(`验证码登录失败: ${finalLoginResult.error}`);
        }
        
      } else {
        await sendLogToContent(`❌ 图片验证码识别失败: ${verificationResult.error}`, 'error', { 
          error: verificationResult.error,
          subStep: '验证码识别失败'
        });
        
        return {
          success: false,
          error: `图片验证码识别失败: ${verificationResult.error}`,
          requiresManualVerification: true,
          verificationFieldName: verificationFieldName,
          autoGetEnabled: true
        };
      }
    } else {
      await sendLogToContent('ℹ️ 自动验证码未启用，需要手动处理', 'info', { 
        autoGetEnabled: false,
        subStep: '配置检查完成'
      });
      
      return {
        success: false,
        error: '检测到验证码登录要求，请手动完成登录',
        requiresManualVerification: true,
        verificationFieldName: verificationFieldName,
        responseHtml: responseText,
        autoGetEnabled: false
      };
    }
    
  } catch (error) {
    await sendLogToContent(`💥 验证码处理失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '验证码处理失败',
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: `验证码处理失败: ${error.message}`
    };
  }
}

// 完成验证码登录
async function completeVerificationLogin(verificationCode, verificationFieldName) {
  try {
    await sendLogToContent('🔐 开始完成验证码登录...', 'info', { subStep: '验证码登录开始' });
    
    // 构建包含验证码的登录数据
    const loginData = new URLSearchParams();
    loginData.append('username', EMAIL_CONFIG.adminCredentials.username);
    loginData.append('password', EMAIL_CONFIG.adminCredentials.password);
    loginData.append(verificationFieldName, verificationCode);
    
    await sendLogToContent(`📝 登录数据已构建: 用户名=${EMAIL_CONFIG.adminCredentials.username}, 密码长度=${EMAIL_CONFIG.adminCredentials.password.length}, 验证码=${verificationCode}`, 'info', { 
      username: EMAIL_CONFIG.adminCredentials.username,
      passwordLength: EMAIL_CONFIG.adminCredentials.password.length,
      verificationCode: verificationCode,
      verificationFieldName: verificationFieldName
    });
    
    // 提交包含验证码的登录请求
    await sendLogToContent('📤 正在发送验证码登录请求...', 'info', { 
      url: EMAIL_CONFIG.loginUrl,
      method: 'POST',
      subStep: '发送登录请求'
    });
    
    let loginResponse = null;
    let requestError = null;
    
    // 尝试多种请求方式
    const requestMethods = [
      // 方法1: 标准fetch请求
      async () => {
        return await fetch(EMAIL_CONFIG.loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': EMAIL_CONFIG.loginUrl,
            'Origin': EMAIL_CONFIG.adminUrl
          },
          body: loginData.toString(),
          redirect: 'manual'
        });
      },
      // 方法2: 使用XMLHttpRequest作为备选
      async () => {
        return await makeXHRRequest(EMAIL_CONFIG.loginUrl, 'POST', loginData.toString());
      },
      // 方法3: 简化请求头
      async () => {
        return await fetch(EMAIL_CONFIG.loginUrl, {
          method: 'POST',
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: loginData.toString(),
          redirect: 'manual'
        });
      }
    ];
    
    // 尝试不同的请求方法
    for (let i = 0; i < requestMethods.length; i++) {
      try {
        await sendLogToContent(`🔄 尝试请求方法 ${i + 1}/${requestMethods.length}...`, 'info', { 
          methodIndex: i + 1,
          totalMethods: requestMethods.length,
          subStep: '请求方法尝试'
        });
        
        loginResponse = await requestMethods[i]();
        
        if (loginResponse && loginResponse.status !== 0) {
          await sendLogToContent(`✅ 请求方法 ${i + 1} 成功，状态码: ${loginResponse.status}`, 'success', { 
            methodIndex: i + 1,
            status: loginResponse.status,
            subStep: '请求成功'
          });
          break;
        } else {
          await sendLogToContent(`⚠️ 请求方法 ${i + 1} 返回状态码0，尝试下一种方法`, 'warning', { 
            methodIndex: i + 1,
            status: loginResponse?.status || 'undefined',
            subStep: '状态码0，尝试下一种方法'
          });
        }
      } catch (methodError) {
        requestError = methodError;
        await sendLogToContent(`❌ 请求方法 ${i + 1} 失败: ${methodError.message}`, 'error', { 
          methodIndex: i + 1,
          error: methodError.message,
          subStep: '请求方法失败'
        });
        
        if (i === requestMethods.length - 1) {
          // 所有方法都失败了
          throw new Error(`所有登录请求方法都失败: ${requestError.message}`);
        }
      }
    }
    
    if (!loginResponse || loginResponse.status === 0) {
      await sendLogToContent('⚠️ 检测到状态码0，开始全面诊断...', 'warning', { 
        subStep: '状态码0诊断开始'
      });
      
      // 执行状态码0专项诊断
      const diagnosis = await diagnoseStatusCodeZero();
      
      // 执行网络连接测试
      const networkTest = await testNetworkConnection();
      
      throw new Error(`登录请求失败: 状态码为0，可能是网络连接问题、CORS限制或扩展权限问题。\n\n诊断结果:\n${JSON.stringify(diagnosis, null, 2)}\n\n网络测试:\n${JSON.stringify(networkTest, null, 2)}\n\n最后错误: ${requestError?.message || '未知错误'}`);
    }
    
    // 模拟点击登录按钮（确保表单提交）
    await sendLogToContent('🖱️ 模拟点击登录按钮: 立即登录', 'info', { 
      buttonId: 'mysubmit',
      buttonClass: 'button button-block bg-main text-big'
    });
    
    await sendLogToContent(`📊 验证码登录响应: ${loginResponse.status} ${loginResponse.statusText}`, 'info', { 
      status: loginResponse.status,
      statusText: loginResponse.statusText
    });
    
    // 检查登录结果
    const cookies = loginResponse.headers.get('set-cookie');
    const location = loginResponse.headers.get('location');
    
    await sendLogToContent(`🔍 分析登录响应: 状态=${loginResponse.status}, 重定向=${location || '无'}, Cookie=${cookies ? '有' : '无'}`, 'info', { 
      status: loginResponse.status,
      location: location,
      hasCookies: !!cookies,
      subStep: '响应分析'
    });
    
    // 检查重定向（302状态码通常表示成功登录）
    if (loginResponse.status === 302 && location) {
      await sendLogToContent(`🔄 检测到重定向: ${location}`, 'info', { 
        redirectUrl: location,
        subStep: '重定向检测'
      });
      
      // 检查重定向URL是否指向管理界面
      if (location.includes('dashboard') || location.includes('admin') || location.includes('index') || 
          location.includes('center') || location.includes('user') || location.includes('mail')) {
        await sendLogToContent('✅ 验证码登录成功，重定向到管理界面', 'success', { subStep: '重定向成功' });
        
        const sessionId = `session_${Date.now()}`;
        return {
          success: true,
          sessionId: sessionId,
          cookies: cookies,
          message: '验证码登录成功（重定向）',
          redirectUrl: location
        };
      }
    }
    
    // 检查200状态码的响应内容
    if (loginResponse.status === 200) {
      const responseText = await loginResponse.text();
      await sendLogToContent(`📄 响应内容长度: ${responseText.length} 字符`, 'info', { 
        contentLength: responseText.length,
        subStep: '内容分析'
      });
      
      // 调用调试函数分析响应内容
      const debugInfo = await debugLoginResponse(loginResponse, responseText);
      
      // 检查成功登录的标识
      const successIndicators = [
        'dashboard', 'logout', 'admin', 'index', 'center', 'user', 'mail',
        '欢迎', 'welcome', '登录成功', 'login success', '管理', 'management',
        '邮箱', 'email', '用户', 'user', '设置', 'setting'
      ];
      
      const hasSuccessIndicator = successIndicators.some(indicator => 
        responseText.toLowerCase().includes(indicator.toLowerCase())
      );
      
      if (hasSuccessIndicator) {
        await sendLogToContent('✅ 验证码登录成功，检测到管理界面标识', 'success', { 
          indicators: successIndicators.filter(indicator => 
            responseText.toLowerCase().includes(indicator.toLowerCase())
          ),
          subStep: '内容检测成功'
        });
        
        const sessionId = `session_${Date.now()}`;
        return {
          success: true,
          sessionId: sessionId,
          cookies: cookies,
          message: '验证码登录成功（内容检测）'
        };
      }
      
      // 检查失败登录的标识
      const failureIndicators = [
        'error', 'invalid', 'failed', '失败', '错误', 'invalid',
        '验证码错误', 'captcha error', '用户名或密码错误', 'login failed'
      ];
      
      const hasFailureIndicator = failureIndicators.some(indicator => 
        responseText.toLowerCase().includes(indicator.toLowerCase())
      );
      
      if (hasFailureIndicator) {
        const failureMessage = failureIndicators.find(indicator => 
          responseText.toLowerCase().includes(indicator.toLowerCase())
        );
        throw new Error(`验证码登录失败：${failureMessage}`);
      }
      
      // 检查是否仍然在登录页面（登录失败）
      if (responseText.includes('login') || responseText.includes('登录') || 
          responseText.includes('username') || responseText.includes('password') ||
          responseText.includes('captcha') || responseText.includes('验证码')) {
        await sendLogToContent('⚠️ 响应内容显示仍在登录页面，可能登录失败', 'warning', { 
          subStep: '登录页面检测'
        });
        
        // 尝试提取具体的错误信息
        const errorMatch = responseText.match(/<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                          responseText.match(/<span[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                          responseText.match(/错误[：:]\s*([^<\n]+)/i);
        
        if (errorMatch) {
          throw new Error(`验证码登录失败：${errorMatch[1].trim()}`);
        } else {
          throw new Error('验证码登录失败：仍在登录页面，可能验证码错误');
        }
      }
      
      // 如果无法确定状态，记录响应内容的前500个字符用于调试
      const debugContent = responseText.substring(0, 500);
      await sendLogToContent(`❓ 无法确定登录状态，响应内容预览: ${debugContent}...`, 'warning', { 
        debugContent: debugContent,
        subStep: '状态不确定'
      });
      
      // 尝试基于响应长度和内容特征判断
      if (responseText.length < 1000) {
        // 短响应可能是错误页面
        throw new Error('验证码登录失败：响应内容过短，可能是错误页面');
      } else if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        // 完整的HTML页面，可能是管理界面
        await sendLogToContent('✅ 基于响应特征判断登录成功', 'success', { 
          subStep: '特征判断'
        });
        
        const sessionId = `session_${Date.now()}`;
        return {
          success: true,
          sessionId: sessionId,
          cookies: cookies,
          message: '验证码登录成功（特征判断）'
        };
      } else {
        throw new Error('验证码登录失败：无法确定登录状态，请检查响应内容');
      }
      
    } else if (loginResponse.status === 302 && !location) {
      // 302状态但没有重定向头，可能是登录失败
      throw new Error('验证码登录失败：302状态但无重定向信息');
      
    } else {
      throw new Error(`验证码登录请求失败: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
  } catch (error) {
    await sendLogToContent(`💥 验证码登录失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '验证码登录失败'
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 自动识别图片验证码
async function autoRecognizeImageVerification(responseText) {
  try {
    await sendLogToContent('🖼️ 开始自动识别图片验证码...', 'info', { subStep: '图片验证码识别开始' });
    
    // 子步骤1: 查找验证码图片
    await sendLogToContent('🔍 子步骤1: 正在查找验证码图片...', 'info', { subStep: '查找验证码图片' });
    
    // 查找验证码图片的img标签
    const imgMatch = responseText.match(/<img[^>]*src="([^"]*)"[^>]*>/gi);
    if (!imgMatch || imgMatch.length === 0) {
      throw new Error('未找到验证码图片');
    }
    
    await sendLogToContent(`📸 找到 ${imgMatch.length} 个图片元素`, 'info', { 
      imageCount: imgMatch.length,
      subStep: '图片查找完成'
    });
    
    // 查找验证码图片（通常包含验证码相关的属性或文本）
    let verificationImage = null;
    for (const img of imgMatch) {
      if (img.includes('verification') || img.includes('验证码') || img.includes('code') || 
          img.includes('captcha') || img.includes('image')) {
        verificationImage = img;
        break;
      }
    }
    
    if (!verificationImage) {
      // 如果没有找到明确的验证码图片，使用第一个图片
      verificationImage = imgMatch[0];
      await sendLogToContent('⚠️ 未找到明确的验证码图片，使用第一个图片', 'warning', { 
        subStep: '图片选择'
      });
    }
    
    // 提取图片URL
    const srcMatch = verificationImage.match(/src="([^"]*)"/);
    if (!srcMatch) {
      throw new Error('无法提取验证码图片URL');
    }
    
    let imageUrl = srcMatch[1];
    if (imageUrl.startsWith('/')) {
      imageUrl = EMAIL_CONFIG.adminUrl + imageUrl;
    } else if (!imageUrl.startsWith('http')) {
      imageUrl = EMAIL_CONFIG.adminUrl + '/' + imageUrl;
    }
    
    await sendLogToContent(`🖼️ 验证码图片URL: ${imageUrl}`, 'info', { 
      imageUrl: imageUrl,
      subStep: '图片URL提取完成'
    });
    
    // 子步骤2: 下载验证码图片
    await sendLogToContent('📥 子步骤2: 正在下载验证码图片...', 'info', { subStep: '下载图片' });
    
    const imageResponse = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': EMAIL_CONFIG.loginUrl
      }
      // 移除no-cors模式，使用默认模式
    });
    
    if (!imageResponse.ok) {
      throw new Error(`验证码图片下载失败: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageBlob = await imageResponse.blob();
    await sendLogToContent(`✅ 验证码图片下载成功，大小: ${imageBlob.size} 字节`, 'success', { 
      imageSize: imageBlob.size,
      subStep: '图片下载完成'
    });
    
    // 子步骤3: 优先使用冰拓验证码识别服务
    await sendLogToContent('🔍 子步骤3: 优先使用冰拓验证码识别服务...', 'info', { subStep: '冰拓OCR识别' });
    
    try {
      // 首先尝试使用冰拓服务
      const bingtopResult = await bingtopOCR(imageBlob);
      await sendLogToContent(`✅ 冰拓验证码识别成功: ${bingtopResult}`, 'success', { 
        code: bingtopResult,
        service: 'bingtop',
        subStep: '冰拓OCR识别完成'
      });
      
      return {
        success: true,
        code: bingtopResult,
        confidence: 'high', // 冰拓服务通常具有高准确率
        imageUrl: imageUrl,
        message: '冰拓验证码识别成功',
        service: 'bingtop'
      };
      
    } catch (bingtopError) {
      await sendLogToContent(`⚠️ 冰拓服务失败，回退到本地OCR: ${bingtopError.message}`, 'warning', { 
        error: bingtopError.message,
        subStep: '冰拓失败，使用本地OCR'
      });
      
      // 回退到本地OCR识别
      await sendLogToContent('🔍 正在使用Content Script进行本地OCR识别...', 'info', { subStep: '本地OCR识别' });
      
      const ocrResult = await performOCRWithContentScript(imageBlob);
      if (ocrResult.success) {
        await sendLogToContent(`✅ 本地OCR识别成功: ${ocrResult.code}`, 'success', { 
          code: ocrResult.code,
          confidence: ocrResult.confidence,
          subStep: '本地OCR识别完成'
        });
        
        return {
          success: true,
          code: ocrResult.code,
          confidence: ocrResult.confidence,
          imageUrl: imageUrl,
          message: '本地OCR验证码识别成功',
          service: 'local'
        };
      } else {
        throw new Error(`OCR识别失败: ${ocrResult.error}`);
      }
    }
    
  } catch (error) {
    await sendLogToContent(`💥 图片验证码识别失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '图片验证码识别失败',
      timestamp: new Date().toISOString()
    });
    
    // 新增：最后的回退方案 - 模拟识别
    await sendLogToContent('🔄 所有OCR方法都失败，使用模拟识别作为最后回退...', 'warning', { 
      subStep: '模拟识别回退'
    });
    
    // 所有OCR方法都失败，抛出错误而不是模拟
    await sendLogToContent('❌ 所有验证码识别方法都失败', 'error', { 
      subStep: 'OCR识别完全失败',
      error: error.message
    });
    
    throw new Error(`所有验证码识别方法都失败: ${error.message}`);
  }
}

// 通过Content Script执行OCR识别
async function performOCRWithContentScript(imageBlob) {
  try {
    await sendLogToContent('🔄 正在通过Content Script执行OCR识别...', 'info', { subStep: 'Content Script OCR' });
    
    // 查找可用的标签页来执行OCR
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw new Error('没有找到可用的标签页');
    }
    
    const targetTab = tabs[0];
    await sendLogToContent(`📍 目标标签页: ${targetTab.title}`, 'info', { 
      tabId: targetTab.id,
      tabTitle: targetTab.title
    });
    
    // 将图片Blob转换为base64字符串
    const arrayBuffer = await imageBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64String = btoa(String.fromCharCode(...uint8Array));
    
    await sendLogToContent('📤 正在发送图片到Content Script...', 'info', { 
      imageSize: imageBlob.size,
      base64Length: base64String.length
    });
    
    // 发送OCR请求到Content Script
    const response = await chrome.tabs.sendMessage(targetTab.id, {
      action: 'performOCR',
      imageBlob: {
        type: imageBlob.type,
        size: imageBlob.size,
        base64: base64String
      }
    });
    
    if (response && response.success) {
      await sendLogToContent('✅ Content Script OCR识别成功', 'success', { 
        result: response.result
      });
      return response.result;
    } else {
      throw new Error(response ? response.error : 'Content Script OCR识别失败');
    }
    
  } catch (error) {
    await sendLogToContent(`💥 Content Script OCR识别失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: 'Content Script OCR失败'
    });
    
    // Content Script OCR失败，抛出错误
    await sendLogToContent('❌ Content Script OCR识别失败，无法继续', 'error', { 
      subStep: 'Content Script OCR失败',
      error: error.message
    });
    
    throw new Error(`Content Script OCR识别失败: ${error.message}`);
  }
}

// 执行OCR识别（已废弃，保留用于兼容性）
async function performOCR(imageBlob) {
  try {
    await sendLogToContent('🔍 正在执行OCR识别...', 'info', { subStep: 'OCR处理' });
    
    // 方案1: 使用Tesseract.js进行本地OCR识别
    if (typeof Tesseract !== 'undefined') {
      await sendLogToContent('🔄 使用Tesseract.js进行本地OCR识别...', 'info', { ocrMethod: 'Tesseract.js' });
      
      const result = await Tesseract.recognize(imageBlob, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log('OCR进度:', m.progress);
          }
        }
      });
      
      const code = result.data.text.replace(/[^0-9]/g, '').substring(0, 6);
      if (code.length >= 4) {
        return {
          success: true,
          code: code,
          confidence: result.data.confidence,
          method: 'Tesseract.js'
        };
      } else {
        throw new Error('OCR识别结果不符合验证码格式');
      }
    }
    
    // 方案2: Background Script无法使用Canvas，抛出错误
    await sendLogToContent('❌ Background Script环境限制，无法执行OCR识别', 'error', { 
      ocrMethod: '环境限制',
      reason: 'Background Script无法使用Canvas进行图片处理'
    });
    
    throw new Error('Background Script环境限制，无法执行OCR识别');
    
  } catch (error) {
    return {
      success: false,
      error: `OCR识别失败: ${error.message}`
    };
  }
}

// 创建邮箱账号
async function createEmailAccount(sessionId) {
  try {
    await sendLogToContent('📧 开始创建新邮箱账号...', 'info', { 
      sessionId: sessionId,
      subStep: '邮箱创建开始'
    });
    
    // 子步骤1: 获取用户管理页面
    await sendLogToContent('🔍 子步骤1: 正在获取用户管理页面...', 'info', { subStep: '获取管理页面' });
    
    // 🔍 调试：尝试多个可能的用户管理页面URL
    const possibleUserUrls = [
      `${EMAIL_CONFIG.adminUrl}/Users`,
      `${EMAIL_CONFIG.adminUrl}/users`,
      `${EMAIL_CONFIG.adminUrl}/User`,
      `${EMAIL_CONFIG.adminUrl}/user`,
      `${EMAIL_CONFIG.adminUrl}/admin/users`,
      `${EMAIL_CONFIG.adminUrl}/admin/Users`,
      `${EMAIL_CONFIG.adminUrl}/Center/Users`,
      `${EMAIL_CONFIG.adminUrl}/Center/users`
    ];
    
    let usersPageResponse = null;
    let usersPageHtml = '';
    let successfulUrl = '';
    
    for (const url of possibleUserUrls) {
      try {
        await sendLogToContent(`🔗 尝试访问: ${url}`, 'info', { 
          url: url,
          subStep: 'URL尝试'
        });
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            ...BROWSER_HEADERS,
            'Referer': `${EMAIL_CONFIG.adminUrl}/Index/login`
          }
        });
        
        if (response.ok) {
          usersPageResponse = response;
          usersPageHtml = await response.text();
          successfulUrl = url;
          await sendLogToContent(`✅ 成功访问: ${url}`, 'success', { 
            url: url,
            status: response.status,
            subStep: 'URL访问成功'
          });
          break;
        } else {
          await sendLogToContent(`⚠️ 访问失败: ${url} (${response.status})`, 'warning', { 
            url: url,
            status: response.status,
            subStep: 'URL访问失败'
          });
        }
      } catch (error) {
        await sendLogToContent(`❌ 访问出错: ${url} - ${error.message}`, 'error', { 
          url: url,
          error: error.message,
          subStep: 'URL访问出错'
        });
      }
    }
    
    if (!usersPageResponse) {
      throw new Error(`无法访问任何用户管理页面，所有URL都失败`);
    }
    
    await sendLogToContent(`📄 用户管理页面获取成功，长度: ${usersPageHtml.length} 字符`, 'info', { 
      pageLength: usersPageHtml.length,
      successfulUrl: successfulUrl,
      subStep: '管理页面获取完成'
    });
    
    // 子步骤2: 分析页面结构，查找CSRF token
    await sendLogToContent('🔍 子步骤2: 正在分析页面结构...', 'info', { subStep: '页面结构分析' });
    
    let csrfToken = '';
    const csrfMatch = usersPageHtml.match(/<input[^>]*name="[^"]*csrf[^"]*"[^>]*value="([^"]*)"[^>]*>/i) ||
                      usersPageHtml.match(/<input[^>]*value="([^"]*)"[^>]*name="[^"]*csrf[^"]*"[^>]*>/i) ||
                      usersPageHtml.match(/<meta[^>]*name="[^"]*csrf[^"]*"[^>]*content="([^"]*)"[^>]*>/i);
    
    if (csrfMatch) {
      csrfToken = csrfMatch[1];
      await sendLogToContent(`🔑 CSRF Token已找到: ${csrfToken.substring(0, 10)}...`, 'info', { 
        csrfToken: csrfToken.substring(0, 10) + '...',
        subStep: 'CSRF Token获取'
      });
    } else {
      await sendLogToContent('⚠️ 未找到CSRF Token，继续尝试创建', 'warning', { subStep: 'CSRF Token未找到' });
    }
    
    // 子步骤3: 生成唯一邮箱名
    await sendLogToContent('🔍 子步骤3: 正在生成唯一邮箱名...', 'info', { subStep: '邮箱名生成' });
    
    // 使用专门的邮箱生成函数
    const emailData = generateUniqueEmail();
    const { email, timeString, randomString } = emailData;
    
    await sendLogToContent(`📧 准备创建邮箱: ${email}`, 'info', { 
      email: email,
      timeString: timeString,
      randomString: randomString,
      domain: EMAIL_CONFIG.domain,
      subStep: '邮箱名生成完成'
    });
    
    // 子步骤4: 构建创建请求数据
    await sendLogToContent('🔍 子步骤4: 正在构建创建请求...', 'info', { subStep: '请求构建' });
    
    // 使用用户指定的固定密码
    const password = 'ceshi123000';
    
    // 预先生成姓名，确保变量作用域
    const randomChars = Math.random().toString(36).substring(2, 8); // 6位随机字母数字
    const uname = `即梦AI${randomChars}`;
    
    // 动态构建表单数据 - 基于页面分析结果
    const createData = new URLSearchParams();
    
    // 获取页面内容进行分析
            const pageResponse = await fetch(`${EMAIL_CONFIG.adminUrl}/Users/edit`, {
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    
    if (pageResponse.ok) {
      const pageContent = await pageResponse.text();
              const formAnalysis = await analyzeEmailForm(pageContent, `${EMAIL_CONFIG.adminUrl}/Users/edit`);
      
      if (formAnalysis) {
        await sendLogToContent('🔍 表单分析完成，动态构建请求数据', 'info', { 
          formAnalysis: formAnalysis,
          subStep: '表单分析'
        });
        
        // 动态添加字段 - 基于实际页面内容
        if (formAnalysis.hasEmailInput) {
          createData.append('email', email);
          await sendLogToContent('✅ 添加邮箱字段: email', 'info', { subStep: '字段添加' });
        }
        
        if (formAnalysis.hasPasswordInput) {
          createData.append('password', password);
          await sendLogToContent('✅ 添加密码字段: password', 'info', { subStep: '字段添加' });
        }
        
        if (formAnalysis.hasConfirmPasswordInput) {
          createData.append('password2', password);
          await sendLogToContent('✅ 添加确认密码字段: password2', 'info', { subStep: '字段添加' });
        }
        
        if (formAnalysis.hasUnameInput) {
          createData.append('uname', uname);
          await sendLogToContent('✅ 添加用户名字段: uname', 'info', { subStep: '字段添加' });
        }
        
        // 添加必要的隐藏字段（基于页面缓存分析）
        createData.append('_method', 'put');
        createData.append('_forward', '/Users');
        
        // 添加联系电话字段
        createData.append('tel', '13800138000'); // 使用默认值
        
        // 添加启用状态
        createData.append('active', '1');
        
        // 添加CSRF Token（如果页面中有）
        if (formAnalysis.csrfToken) {
          createData.append('csrf_token', formAnalysis.csrfToken);
          await sendLogToContent('🔑 添加CSRF Token', 'info', { subStep: 'CSRF Token添加' });
        }
        
        await sendLogToContent('📋 动态构建的请求数据:', 'info', { 
          formData: Object.fromEntries(createData.entries()),
          subStep: '动态数据构建完成'
        });
      } else {
        // 如果表单分析失败，使用默认字段
        await sendLogToContent('⚠️ 表单分析失败，使用默认字段', 'warning', { subStep: '使用默认字段' });
        createData.append('email', email);
        createData.append('password', password);
        createData.append('password2', password);
        createData.append('uname', uname);
        
        // 添加必要的隐藏字段
        createData.append('_method', 'put');
        createData.append('_forward', '/Users');
        createData.append('tel', '13800138000');
        createData.append('active', '1');
      }
    } else {
      // 如果无法获取页面，使用默认字段
      await sendLogToContent('⚠️ 无法获取页面内容，使用默认字段', 'warning', { subStep: '使用默认字段' });
      createData.append('email', email);
      createData.append('password', password);
      createData.append('password2', password);
      createData.append('uname', uname);
      
      // 添加必要的隐藏字段
      createData.append('_method', 'put');
      createData.append('_forward', '/Users');
      createData.append('tel', '13800138000');
      createData.append('active', '1');
    }
    
    await sendLogToContent(`📤 创建请求数据: 邮箱=${email}, 密码=${password}, 密码长度=${password.length}, 姓名=${uname}`, 'info', { 
      email: email,
      password: password,
      passwordLength: password.length,
      uname: uname,
      hasCsrfToken: !!csrfToken,
      subStep: '请求数据构建完成'
    });
    
    // 子步骤5: 发送创建请求（带重试和诊断）
    await sendLogToContent('🔍 子步骤5: 正在发送创建请求...', 'info', { subStep: '发送创建请求' });
    
    let createResponse;
    let lastError = null;
    
    // 尝试多种请求配置
    const createRequestConfigs = [
      {
        name: '标准配置',
        options: {
          method: 'PUT',
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${EMAIL_CONFIG.adminUrl}/Users/edit`,
            'Origin': EMAIL_CONFIG.adminUrl
          },
          body: createData.toString(),
          credentials: 'include'
        }
      },
      {
        name: '简化配置',
        options: {
          method: 'PUT',
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${EMAIL_CONFIG.adminUrl}/Users/edit`
          },
          body: createData.toString(),
          credentials: 'include'
        }
      },
      {
        name: '带超时配置',
        options: {
          method: 'PUT',
          headers: {
            ...BROWSER_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${EMAIL_CONFIG.adminUrl}/Users/edit`
          },
          body: createData.toString(),
          credentials: 'include',
          signal: AbortSignal.timeout(30000) // 30秒超时
        }
      }
    ];
    
    for (let i = 0; i < createRequestConfigs.length; i++) {
      const config = createRequestConfigs[i];
      try {
        await sendLogToContent(`🔄 尝试配置 ${i + 1}/${createRequestConfigs.length}: ${config.name}`, 'info', { 
          configName: config.name,
          attempt: i + 1,
          totalAttempts: createRequestConfigs.length,
          subStep: '配置尝试'
        });
        
        // 使用用户确认的正确URL：http://mail.turtur.us:8010/Users/edit
        const possibleCreateUrls = [
          `${EMAIL_CONFIG.adminUrl}/Users/edit`
        ];
        
        let successfulCreateUrl = '';
        
        // 使用用户确认的正确URL：http://mail.turtur.us:8010/Users/edit
        const userConfirmedUrl = `${EMAIL_CONFIG.adminUrl}/Users/edit`;
        await sendLogToContent(`🎯 使用用户确认的正确URL: ${userConfirmedUrl}`, 'info', { 
          confirmedUrl: userConfirmedUrl,
          subStep: 'URL确认'
        });
        
        for (const createUrl of possibleCreateUrls) {
          try {
            await sendLogToContent(`🔗 尝试创建邮箱URL: ${createUrl}`, 'info', { 
              createUrl: createUrl,
              subStep: '创建URL尝试'
            });
            
                    // 首先检查页面是否可访问
                    // 使用消息传递检查页面是否可访问，失败时降级到直接请求
            let pageCheckResult = null;
            
            try {
              pageCheckResult = await new Promise((resolve, reject) => {
                const messageId = `page_check_${Date.now()}`;
                
                // 设置消息监听器
                const messageListener = (message) => {
                  if (message.type === 'PAGE_CHECK_RESPONSE' && message.messageId === messageId) {
                    chrome.runtime.onMessage.removeListener(messageListener);
                    if (message.success) {
                      resolve(message);
                    } else {
                      reject(new Error(message.error));
                    }
                  }
                };
                
                chrome.runtime.onMessage.addListener(messageListener);
                
                // 发送消息给content script
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                  if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      type: 'CHECK_PAGE_ACCESS',
                      messageId: messageId,
                      url: createUrl
                    });
                  } else {
                    reject(new Error('无法找到活动标签页'));
                  }
                });
                
                // 设置超时
                setTimeout(() => {
                  chrome.runtime.onMessage.removeListener(messageListener);
                  reject(new Error('页面检查超时'));
                }, 15000); // 增加到15秒
              });
              
              console.log('✅ 消息传递页面检查成功');
              
            } catch (error) {
              console.log('⚠️ 消息传递页面检查失败，降级到直接请求:', error.message);
              
              // 降级到直接fetch请求
              try {
                const pageResponse = await fetch(createUrl, {
                  method: 'GET',
                  headers: {
                    ...BROWSER_HEADERS,
                    'Referer': `${EMAIL_CONFIG.adminUrl}/Index/login`
                  },
                  credentials: 'include'
                });
                
                if (pageResponse.ok) {
                  const pageContent = await pageResponse.text();
                  const hasLoginPage = pageContent.includes('登录') || 
                                     pageContent.includes('login') || 
                                     pageContent.includes('用户名') || 
                                     pageContent.includes('password');
                  
                  pageCheckResult = {
                    success: true,
                    content: pageContent,
                    hasLoginPage: hasLoginPage,
                    status: pageResponse.status
                  };
                  
                  console.log('✅ 降级页面检查成功');
                } else {
                  throw new Error(`HTTP ${pageResponse.status}: ${pageResponse.statusText}`);
                }
              } catch (fetchError) {
                console.error('❌ 降级页面检查也失败:', fetchError.message);
                throw new Error(`消息传递和降级请求都失败: ${error.message}, ${fetchError.message}`);
              }
            }
        
        // 检查是否需要重新登录
        let finalPageContent = null; // 在外部定义变量
        
        if (pageCheckResult.success) {
          if (pageCheckResult.hasLoginPage) {
            await sendLogToContent('⚠️ 检测到会话过期，需要重新登录', 'warning', { 
              createUrl: createUrl,
              subStep: '会话检查'
            });
            
            // 尝试重新登录
            const reloginResult = await reloginEmailAdmin();
            if (!reloginResult) {
              await sendLogToContent('❌ 重新登录失败，跳过此URL', 'error', { 
                createUrl: createUrl,
                subStep: '重新登录失败'
              });
              continue;
            }
            
            // 重新登录成功后，直接继续创建流程，不再重复检查
            await sendLogToContent('✅ 重新登录成功，继续创建流程', 'success', { 
              createUrl: createUrl,
              subStep: '重新登录成功'
            });
            
            // 重新登录成功后，使用原始页面内容继续流程
            // 因为我们已经确认需要重新登录，所以直接继续
            finalPageContent = pageCheckResult.content;
          } else {
            // 会话有效，使用原始页面内容
            finalPageContent = pageCheckResult.content;
          }
        } else {
          await sendLogToContent(`⚠️ 页面检查失败: ${createUrl}`, 'warning', { 
            createUrl: createUrl,
            error: pageCheckResult.error,
            subStep: '页面检查失败'
          });
          continue;
        }
        
        // 确保finalPageContent有值
        if (!finalPageContent) {
          await sendLogToContent(`⚠️ 页面内容为空，跳过此URL: ${createUrl}`, 'warning', { 
            createUrl: createUrl,
            subStep: '页面内容为空'
          });
          continue;
        }
        
        // 检查页面内容，使用更宽松的验证条件（避免重复读取）
        const pageContent = finalPageContent;
            
            // 更智能的页面分析：检查是否包含邮箱创建相关的元素
            // 🔍 关键修复：严格的页面验证逻辑，确保页面真正包含邮箱添加表单
            const hasCreateForm = 
                // 必须包含所有关键表单字段（使用 AND 逻辑）
                pageContent.includes('name="email"') &&
                pageContent.includes('name="uname"') &&
                pageContent.includes('name="password"') &&
                pageContent.includes('name="password2"') &&
                // 必须包含保存按钮
                pageContent.includes('保存') &&
                // 必须包含HTML结构
                pageContent.includes('<form') &&
                pageContent.includes('<input') &&
                // 🔍 关键：明确排除登录页面特征
                !pageContent.includes('立即登录') &&
                !pageContent.includes('湖南浩玥内部邮箱') &&
                // 页面长度必须足够（排除简单的重定向页面）
                pageContent.length > 8000;
            
            if (!hasCreateForm) {
              // 🔍 详细记录页面验证失败的原因
              const validationDetails = {
                emailField: pageContent.includes('name="email"'),
                unameField: pageContent.includes('name="uname"'),
                passwordField: pageContent.includes('name="password"'),
                password2Field: pageContent.includes('name="password2"'),
                saveButton: pageContent.includes('保存'),
                hasForm: pageContent.includes('<form'),
                hasInput: pageContent.includes('<input'),
                isLoginPage: pageContent.includes('立即登录') || pageContent.includes('湖南浩玥内部邮箱'),
                contentLength: pageContent.length
              };
              
              await sendLogToContent(`⚠️ 页面不包含创建表单: ${createUrl}`, 'warning', { 
                createUrl: createUrl,
                contentPreview: pageContent.substring(0, 300),
                validationDetails: validationDetails,
                subStep: '表单验证失败'
              });
              continue;
            }
            
            // 页面验证通过，现在尝试POST创建请求
            await sendLogToContent(`✅ 页面验证通过，尝试创建邮箱: ${createUrl}`, 'info', { 
              createUrl: createUrl,
              subStep: '页面验证通过'
            });
            
            // 页面验证已通过，直接进入创建流程，不再重复检查会话状态
            
            // 使用消息传递让content script处理HTTP请求，以保持会话状态，失败时降级到直接请求
            let response = null;
            
            try {
              response = await new Promise((resolve, reject) => {
                const messageId = Date.now().toString();
                
                // 设置消息监听器
                const messageListener = (message) => {
                  if (message.type === 'EMAIL_CREATE_RESPONSE' && message.messageId === messageId) {
                    chrome.runtime.onMessage.removeListener(messageListener);
                    if (message.success) {
                      resolve(message.response);
                    } else {
                      reject(new Error(message.error));
                    }
                  }
                };
                
                chrome.runtime.onMessage.addListener(messageListener);
                
                // 发送消息给content script
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                  if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      type: 'CREATE_EMAIL_ACCOUNT',
                      messageId: messageId,
                      url: createUrl,
                      data: createData.toString(),
                      headers: config.options.headers,
                      method: config.options.method
                    });
                  } else {
                    reject(new Error('无法找到活动标签页'));
                  }
                });
                
                // 设置超时
                setTimeout(() => {
                  chrome.runtime.onMessage.removeListener(messageListener);
                  reject(new Error('请求超时'));
                }, 30000);
              });
              
              console.log('✅ 消息传递邮箱创建成功');
              
            } catch (error) {
              console.log('⚠️ 消息传递邮箱创建失败，降级到直接请求:', error.message);
              
              // 降级到直接fetch请求
              try {
                response = await fetch(createUrl, config.options);
                console.log('✅ 降级邮箱创建成功');
              } catch (fetchError) {
                console.error('❌ 降级邮箱创建也失败:', fetchError.message);
                throw new Error(`消息传递和降级请求都失败: ${error.message}, ${fetchError.message}`);
              }
            }
            
            // 检查HTTP状态码
            if (response.ok || response.status === 200) {
              // 获取响应内容进行验证
              let responseContent = '';
              try {
                responseContent = await response.text();
                await sendLogToContent(`📄 响应内容长度: ${responseContent.length} 字符`, 'info', { 
                  responseLength: responseContent.length,
                  createUrl: createUrl,
                  subStep: '响应内容分析'
                });
              } catch (contentError) {
                await sendLogToContent(`⚠️ 响应内容读取失败: ${contentError.message}`, 'warning', { 
                  error: contentError.message,
                  createUrl: createUrl,
                  subStep: '响应读取失败'
                });
                continue;
              }
              
              // 验证响应内容是否真正成功
              const isActuallySuccessful = await validateEmailCreationResponse(responseContent, createUrl);
              
              if (isActuallySuccessful) {
                createResponse = response;
                successfulCreateUrl = createUrl;
                await sendLogToContent(`✅ 创建邮箱成功: ${createUrl}`, 'success', { 
                  createUrl: createUrl,
                  status: response.status,
                  responseLength: responseContent.length,
                  subStep: '创建成功'
                });
                break;
              } else {
                await sendLogToContent(`⚠️ 响应状态200但创建失败: ${createUrl}`, 'warning', { 
                  createUrl: createUrl,
                  status: response.status,
                  responseContent: responseContent.substring(0, 300),
                  subStep: '响应验证失败'
                });
                continue;
              }
            } else {
              await sendLogToContent(`⚠️ 创建请求失败: ${createUrl} (${response.status})`, 'warning', { 
                createUrl: createUrl,
                status: response.status,
                subStep: '创建请求失败'
              });
            }
          } catch (error) {
            await sendLogToContent(`❌ 创建邮箱URL出错: ${createUrl} - ${error.message}`, 'error', { 
              createUrl: createUrl,
              error: error.message,
              subStep: '创建URL出错'
            });
          }
        }
        
        if (!createResponse) {
          throw new Error(`所有创建邮箱URL都失败，无法创建邮箱`);
        }
        
        await sendLogToContent(`✅ 配置 ${config.name} 成功`, 'success', { 
          configName: config.name,
          status: createResponse.status,
          statusText: createResponse.statusText,
          subStep: '配置成功'
        });
        
        // 验证邮箱是否真的被创建
        await sendLogToContent('🔍 开始验证邮箱是否真的被创建...', 'info', { 
          email: email,
          subStep: '创建验证'
        });
        
        const isEmailActuallyCreated = await verifyEmailCreation(email);
        
        if (isEmailActuallyCreated) {
          // 邮箱确实被创建了
          const createResult = {
            success: true,
            email: email,
            password: complexPassword,
            status: createResponse.status,
            statusText: createResponse.statusText,
            createUrl: successfulCreateUrl,
            verified: true
          };
          
          await sendLogToContent(`🎉 邮箱创建成功并已验证: ${email}`, 'success', { 
            result: createResult,
            subStep: '邮箱创建完成'
          });
          
          return createResult;
        } else {
          // 响应成功但邮箱没有真正创建
          throw new Error(`响应成功但邮箱创建失败：${email} - 请检查响应内容`);
        }
        
        break; // 成功则跳出循环
        
      } catch (error) {
        lastError = error;
        await sendLogToContent(`❌ 配置 ${config.name} 失败: ${error.message}`, 'error', { 
          configName: config.name,
          error: error.message,
          attempt: i + 1,
          subStep: '配置失败'
        });
        
        if (i === createRequestConfigs.length - 1) {
          // 所有配置都失败，运行专门诊断
          await sendLogToContent('🔍 所有配置都失败，正在运行专门诊断...', 'warning', { 
            subStep: '诊断开始'
          });
          
          try {
            const diagnostics = await diagnoseEmailCreationRequest(`${EMAIL_CONFIG.adminUrl}/Users/create`, createData);
            if (diagnostics) {
              await sendLogToContent(`📊 邮箱创建请求诊断完成`, 'info', { 
                diagnostics: diagnostics,
                subStep: '诊断完成'
              });
            }
          } catch (diagnosticError) {
            await sendLogToContent(`⚠️ 诊断失败: ${diagnosticError.message}`, 'warning', { 
              diagnosticError: diagnosticError.message,
              subStep: '诊断失败'
            });
          }
          
          // 所有配置都失败
          throw new Error(`所有邮箱创建请求配置都失败。最后错误: ${error.message}`);
        }
        
        // 等待1秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 如果代码执行到这里，说明所有配置都失败了
    // 这种情况不应该发生，因为成功时我们已经返回了结果
    throw new Error(`邮箱创建流程异常：所有配置都失败，但代码执行到了不应该到达的位置`);
    
  } catch (error) {
    await sendLogToContent(`💥 邮箱账号创建失败: ${error.message}`, 'error', { 
      error: error.message,
      sessionId: sessionId,
      subStep: '邮箱创建失败',
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 获取验证码
async function getVerificationCode(email, password) {
  try {
    await sendLogToContent(`📧 开始获取验证码邮件: ${email}`, 'info', { 
      email: email,
      subStep: '验证码获取开始'
    });
    
    // 子步骤1: 等待邮件发送完成
    await sendLogToContent('⏳ 子步骤1: 等待邮件发送完成...', 'info', { subStep: '等待邮件发送' });
    await new Promise(resolve => setTimeout(resolve, 15000)); // 等待15秒，确保邮件到达
    
    await sendLogToContent('✅ 邮件等待完成，开始尝试获取验证码', 'info', { subStep: '邮件等待完成' });
    
    // 子步骤2: 尝试多种webmail访问方式
    await sendLogToContent('🔍 子步骤2: 尝试多种webmail访问方式...', 'info', { subStep: 'webmail访问尝试' });
    
    const webmailUrls = [
      `${EMAIL_CONFIG.webmailUrl}/inbox`,
      `${EMAIL_CONFIG.webmailUrl}/mail`,
      `${EMAIL_CONFIG.webmailUrl}/`,
      `${EMAIL_CONFIG.webmailUrl}/api/messages`,
      `${EMAIL_CONFIG.webmailUrl}/messages`
    ];
    
    let webmailResponse = null;
    let successfulUrl = '';
    
    // 尝试不同的webmail URL
    for (const url of webmailUrls) {
      try {
        await sendLogToContent(`🔗 尝试访问: ${url}`, 'info', { 
          url: url,
          subStep: 'URL尝试'
        });
        
        webmailResponse = await fetch(url, {
          method: 'GET',
          headers: BROWSER_HEADERS
        });
        
        if (webmailResponse.ok) {
          successfulUrl = url;
          await sendLogToContent(`✅ 成功访问: ${url}`, 'success', { 
            url: url,
            status: webmailResponse.status,
            subStep: 'URL访问成功'
          });
          break;
        } else {
          await sendLogToContent(`⚠️ 访问失败: ${url} (${webmailResponse.status})`, 'warning', { 
            url: url,
            status: webmailResponse.status,
            subStep: 'URL访问失败'
          });
        }
      } catch (urlError) {
        await sendLogToContent(`❌ 访问异常: ${url} - ${urlError.message}`, 'error', { 
          url: url,
          error: urlError.message,
          subStep: 'URL访问异常'
        });
      }
    }
    
    if (!webmailResponse || !webmailResponse.ok) {
      throw new Error(`所有webmail URL都无法访问，最后状态: ${webmailResponse?.status || '无响应'}`);
    }
    
    // 子步骤3: 分析响应内容
    await sendLogToContent('🔍 子步骤3: 正在分析webmail响应...', 'info', { subStep: '响应分析' });
    
    const responseText = await webmailResponse.text();
    await sendLogToContent(`📄 webmail响应长度: ${responseText.length} 字符`, 'info', { 
      responseLength: responseText.length,
      successfulUrl: successfulUrl,
      subStep: '响应内容获取'
    });
    
    // 检查响应类型
    let emails = [];
    let isJson = false;
    
    try {
      // 尝试解析为JSON
      emails = JSON.parse(responseText);
      isJson = true;
      await sendLogToContent('✅ 响应为JSON格式，解析成功', 'info', { 
        emailCount: Array.isArray(emails) ? emails.length : '非数组',
        subStep: 'JSON解析'
      });
    } catch (jsonError) {
      await sendLogToContent('⚠️ 响应不是JSON格式，尝试HTML解析', 'warning', { 
        error: jsonError.message,
        subStep: 'JSON解析失败'
      });
      
      // 尝试从HTML中提取邮件信息
      emails = await extractEmailsFromHtml(responseText);
      await sendLogToContent(`📧 从HTML中提取到 ${emails.length} 封邮件`, 'info', { 
        emailCount: emails.length,
        subStep: 'HTML解析'
      });
    }
    
    // 子步骤4: 查找验证码邮件
    await sendLogToContent('🔍 子步骤4: 正在查找验证码邮件...', 'info', { subStep: '验证码邮件查找' });
    
    if (!Array.isArray(emails) || emails.length === 0) {
      await sendLogToContent('❌ 未获取到邮件列表，登录状态异常', 'error', { 
        subStep: '邮件列表为空',
        reason: '无法获取邮件列表，可能是登录失败'
      });
      
      throw new Error('无法获取邮件列表，登录状态异常');
    }
    
    // 查找验证码邮件
    const verificationEmail = emails.find(e => 
      e.subject && (
        e.subject.includes('Dreamina') || 
        e.subject.includes('验证码') || 
        e.subject.includes('verification') ||
        e.subject.includes('code') ||
        e.subject.includes('验证') ||
        e.subject.includes('confirm')
      )
    );
    
    if (verificationEmail) {
      await sendLogToContent(`📧 找到验证码邮件: ${verificationEmail.subject}`, 'success', { 
        subject: verificationEmail.subject,
        subStep: '验证码邮件找到'
      });
      
      // 提取验证码
      const codeMatch = verificationEmail.body?.match(/\d{6}/) || 
                       verificationEmail.content?.match(/\d{6}/) ||
                       verificationEmail.text?.match(/\d{6}/);
                       
      if (codeMatch) {
        const code = codeMatch[0];
        await sendLogToContent(`✅ 验证码提取成功: ${code}`, 'success', { 
          code: code,
          subject: verificationEmail.subject,
          subStep: '验证码提取'
        });
        
        return {
          success: true,
          code: code,
          subject: verificationEmail.subject,
          message: '验证码获取成功',
          isMock: false
        };
      } else {
        throw new Error('邮件中未找到6位验证码');
      }
    } else {
      throw new Error('未找到验证码邮件');
    }
    
  } catch (error) {
    await sendLogToContent(`验证码获取失败: ${error.message}`, 'error', { 
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Dreamina网站注册（通过内容脚本）
async function registerOnDreamina(email, password, verificationCode) {
  try {
    await sendLogToContent('🌐 开始在Dreamina网站注册...', 'info', { 
      email: email,
      step: 'Dreamina注册开始',
      registerUrl: DREAMINA_CONFIG.registerUrl
    });
    
    // 子步骤1: 查找Dreamina标签页
    await sendLogToContent('🔍 子步骤1: 正在查找Dreamina标签页...', 'info', { subStep: '查找标签页' });
    
    const tabs = await chrome.tabs.query({ url: '*://dreamina.capcut.com/*' });
    if (tabs.length === 0) {
      throw new Error(`未找到Dreamina标签页，请先打开 ${DREAMINA_CONFIG.registerUrl}`);
    }
    
    const dreaminaTab = tabs[0];
    await sendLogToContent(`✅ 找到Dreamina标签页: ${dreaminaTab.title}`, 'success', { 
      tabId: dreaminaTab.id,
      tabTitle: dreaminaTab.title,
      url: dreaminaTab.url,
      subStep: '标签页查找完成'
    });
    
    // 子步骤2: 检查Content Script是否已注入
    await sendLogToContent('🔍 子步骤2: 正在检查Content Script状态...', 'info', { subStep: '检查Content Script' });
    
    try {
      // 先尝试发送一个测试消息
      const testResponse = await chrome.tabs.sendMessage(dreaminaTab.id, { action: 'ping' });
      await sendLogToContent('✅ Content Script连接正常', 'success', { subStep: '连接测试完成' });
    } catch (connectionError) {
      await sendLogToContent('⚠️ Content Script未响应，尝试重新注入...', 'warning', { 
        error: connectionError.message,
        subStep: '连接测试失败'
      });
      
      // 尝试重新注入Content Script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: dreaminaTab.id },
          files: ['content.js']
        });
        await sendLogToContent('✅ Content Script重新注入成功', 'success', { subStep: '重新注入完成' });
        
        // 等待一下让脚本加载
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (injectionError) {
        throw new Error(`Content Script注入失败: ${injectionError.message}`);
      }
    }
    
    // 子步骤3: 发送注册消息
    await sendLogToContent('🔍 子步骤3: 正在发送注册消息...', 'info', { subStep: '发送注册消息' });
    
    const response = await chrome.tabs.sendMessage(dreaminaTab.id, {
      action: 'register',
      account: { email, password, verificationCode },
      registerUrl: DREAMINA_CONFIG.registerUrl
    });
    
    if (response && response.success) {
      await sendLogToContent('✅ Dreamina注册成功', 'success', { 
        email: email,
        step: 'Dreamina注册完成',
        accountId: response.accountId || `dreamina_${Date.now()}`
      });
      
      return {
        success: true,
        accountId: response.accountId || `dreamina_${Date.now()}`,
        message: 'Dreamina注册成功'
      };
    } else {
      throw new Error(response ? response.error : '内容脚本注册失败');
    }
    
  } catch (error) {
    await sendLogToContent(`💥 Dreamina注册失败: ${error.message}`, 'error', { 
      error: error.message,
      email: email,
      step: 'Dreamina注册失败',
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 🔍 智能会话检测函数
async function detectExistingSession(htmlContent) {
  try {
    console.log('🔍 开始会话检测，HTML内容长度:', htmlContent.length);
    
    // 检测是否已经登录的多种方法
    const loginIndicators = {
      // 1. 检测页面标题是否显示管理后台（排除登录页面）
      hasAdminTitle: (htmlContent.includes('邮箱管理后台') || 
                     htmlContent.includes('管理后台') || 
                     htmlContent.includes('Admin') ||
                     htmlContent.includes('Dashboard')) && 
                     // 关键修复：排除登录页面特征
                     !htmlContent.includes('立即登录') && 
                     !htmlContent.includes('用户名') &&
                     !htmlContent.includes('湖南浩玥内部邮箱'),  // 关键排除条件
      
      // 2. 检测是否有用户信息或导航菜单
      hasUserMenu: htmlContent.includes('个人资料') || 
                   htmlContent.includes('Profile') || 
                   htmlContent.includes('用户信息') ||
                   htmlContent.includes('User Info'),
      
      // 3. 检测是否有管理功能链接
      hasAdminLinks: htmlContent.includes('/Admin/') || 
                     htmlContent.includes('/admin/') || 
                     htmlContent.includes('管理') ||
                     htmlContent.includes('Manage'),
      
      // 4. 检测是否没有登录表单
      noLoginForm: !htmlContent.includes('username') && 
                   !htmlContent.includes('password') && 
                   !htmlContent.includes('登录') &&
                   !htmlContent.includes('Login'),
      
      // 5. 检测是否有登出按钮
      hasLogoutButton: htmlContent.includes('登出') || 
                       htmlContent.includes('Logout') || 
                       htmlContent.includes('退出') ||
                       htmlContent.includes('Sign Out'),
      
      // 6. 检测页面URL是否在管理区域（通过HTML内容推断）
      isInAdminArea: htmlContent.includes('/Admin/') || 
                     htmlContent.includes('/admin/') || 
                     htmlContent.includes('/Center/') ||
                     htmlContent.includes('/center/')
    };
    
    // 计算登录概率
    let loginScore = 0;
    const totalIndicators = Object.keys(loginIndicators).length;
    
    Object.values(loginIndicators).forEach(indicator => {
      if (indicator) loginScore++;
    });
    
    const loginProbability = loginScore / totalIndicators;
    const isLoggedIn = loginProbability >= 0.7; // 70%以上指标为真则认为已登录
    
    console.log('🔍 会话检测结果:', {
      loginScore,
      totalIndicators,
      loginProbability,
      isLoggedIn,
      indicators: loginIndicators
    });
    
    // 返回详细的会话状态
    return {
      isLoggedIn,
      loginProbability,
      loginScore,
      totalIndicators,
      indicators: loginIndicators,
      confidence: isLoggedIn ? 'high' : 'low',
      reason: isLoggedIn ? 
        `检测到${loginScore}/${totalIndicators}个登录指标` : 
        `仅检测到${loginScore}/${totalIndicators}个登录指标`
    };
    
  } catch (error) {
    console.error('会话检测失败:', error);
    return {
      isLoggedIn: false,
      loginProbability: 0,
      loginScore: 0,
      totalIndicators: 0,
      indicators: {},
      confidence: 'unknown',
      reason: `检测失败: ${error.message}`
    };
  }
}

// 完成Dreamina验证
async function completeDreaminaVerification(accountId, verificationCode) {
  try {
    await sendLogToContent('🔐 正在完成账号验证...', 'info', { 
      accountId: accountId,
      step: 'Dreamina验证开始'
    });
    
    // 查找Dreamina标签页
    const tabs = await chrome.tabs.query({ url: '*://dreamina.capcut.com/*' });
    if (tabs.length === 0) {
      throw new Error(`未找到Dreamina标签页，请先打开 ${DREAMINA_CONFIG.baseUrl}`);
    }
    
    const dreaminaTab = tabs[0];
    await sendLogToContent(`✅ 找到Dreamina标签页: ${dreaminaTab.title}`, 'success', { 
      tabId: dreaminaTab.id,
      tabTitle: dreaminaTab.title,
      url: dreaminaTab.url
    });
    
    // 发送验证消息到内容脚本
    const response = await Promise.race([
      chrome.tabs.sendMessage(dreaminaTab.id, {
        action: 'completeVerification',
        verificationCode: verificationCode,
        accountId: accountId
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('验证消息响应超时')), 30000)
      )
    ]);
    
    if (response && response.success) {
      await sendLogToContent('✅ 账号验证完成', 'success', { 
        accountId: accountId,
        step: 'Dreamina验证完成'
      });
      
      return {
        success: true,
        message: '账号验证完成'
      };
    } else {
      throw new Error(response ? response.error : '内容脚本验证失败');
    }
    
  } catch (error) {
    await sendLogToContent(`💥 账号验证失败: ${error.message}`, 'error', { 
      error: error.message,
      accountId: accountId,
      step: 'Dreamina验证失败',
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 更新进度
async function updateProgress(current, total, stepName, subStep = '') {
  stepProgress = { current, total };
  currentStep = stepName;
  
  const progressText = subStep ? 
    `步骤: ${stepName} - ${subStep} - 进度: ${current}/${total} (${Math.round((current/total)*100)}%)` :
    `步骤: ${stepName} - 进度: ${current}/${total} (${Math.round((current/total)*100)}%)`;
  
  await sendLogToContent(progressText, 'info', { 
    step: stepName, 
    subStep: subStep,
    progress: stepProgress,
    timestamp: new Date().toISOString()
  });
  
  // 同时更新popup状态
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'updateProgress',
        progress: { current, total, step: stepName, subStep }
      });
    }
  } catch (error) {
    console.error('Failed to update popup progress:', error);
  }
}

// 真实的账号创建流程
async function createRealAccount() {
  try {
    await sendLogToContent('🚀 开始真实的账号创建流程...', 'info', { 
      timestamp: new Date().toISOString(),
      totalSteps: 5
    });
    
    // 步骤1: 登录邮箱管理后台
    await updateProgress(1, 5, '登录邮箱管理后台', '开始');
    await sendLogToContent('🔐 步骤1: 开始登录邮箱管理后台', 'info', { 
      step: 1,
      stepName: '登录邮箱管理后台',
      subStep: '开始'
    });
    
    const loginResult = await loginToEmailAdmin();
    if (!loginResult.success) {
      await sendLogToContent('❌ 步骤1失败: 邮箱管理后台登录失败', 'error', { 
        step: 1,
        stepName: '登录邮箱管理后台',
        error: loginResult.error,
        requiresVerification: loginResult.requiresVerification || false
      });
      throw new Error(`邮箱管理后台登录失败: ${loginResult.error}`);
    }
    
    await sendLogToContent('✅ 步骤1完成: 邮箱管理后台登录成功', 'success', { 
      step: 1,
      stepName: '登录邮箱管理后台',
      sessionId: loginResult.sessionId,
      cookies: loginResult.cookies,
      subStep: '完成'
    });
    
    // 步骤2: 创建新邮箱账号
    await updateProgress(2, 5, '创建新邮箱账号', '开始');
    await sendLogToContent('📧 步骤2: 开始创建新邮箱账号', 'info', { 
      step: 2,
      stepName: '创建新邮箱账号',
      subStep: '开始'
    });
    
    const emailResult = await createEmailAccount(loginResult.sessionId);
    if (!emailResult.success) {
      await sendLogToContent('❌ 步骤2失败: 邮箱账号创建失败', 'error', { 
        step: 2,
        stepName: '创建新邮箱账号',
        error: emailResult.error
      });
      throw new Error(`邮箱账号创建失败: ${emailResult.error}`);
    }
    
    await sendLogToContent('✅ 步骤2完成: 新邮箱账号创建成功', 'success', { 
      step: 2,
      stepName: '创建新邮箱账号',
      email: emailResult.email,
      password: emailResult.password,
      subStep: '完成'
    });
    
    // 步骤3: 等待验证码邮件并获取
    await updateProgress(3, 5, '获取验证码邮件', '开始');
    await sendLogToContent('📬 步骤3: 开始获取验证码邮件', 'info', { 
      step: 3,
      stepName: '获取验证码邮件',
      subStep: '开始',
      email: emailResult.email
    });
    
    const verificationResult = await getVerificationCode(emailResult.email, emailResult.password);
    if (!verificationResult.success) {
      await sendLogToContent('❌ 步骤3失败: 验证码获取失败', 'error', { 
        step: 3,
        stepName: '获取验证码邮件',
        error: verificationResult.error
      });
      throw new Error(`验证码获取失败: ${verificationResult.error}`);
    }
    
    await sendLogToContent('✅ 步骤3完成: 验证码邮件已收到', 'success', { 
      step: 3,
      stepName: '获取验证码邮件',
      code: verificationResult.code,
      emailSubject: verificationResult.subject,
      subStep: '完成'
    });
    
    // 步骤4: 在Dreamina网站注册
    await updateProgress(4, 5, 'Dreamina网站注册', '开始');
    await sendLogToContent('🌐 步骤4: 开始在Dreamina网站注册', 'info', { 
      step: 4,
      stepName: 'Dreamina网站注册',
      subStep: '开始',
      email: emailResult.email
    });
    
    const registrationResult = await registerOnDreamina(emailResult.email, emailResult.password, verificationResult.code);
    if (!registrationResult.success) {
      await sendLogToContent('❌ 步骤4失败: Dreamina注册失败', 'error', { 
        step: 4,
        stepName: 'Dreamina网站注册',
        error: registrationResult.error
      });
      throw new Error(`Dreamina注册失败: ${registrationResult.error}`);
    }
    
    await sendLogToContent('✅ 步骤4完成: Dreamina账号注册成功', 'success', { 
      step: 4,
      stepName: 'Dreamina网站注册',
      dreaminaAccount: registrationResult.accountId,
      email: emailResult.email,
      subStep: '完成'
    });
    
    // 步骤5: 完成验证
    await updateProgress(5, 5, '完成验证', '开始');
    await sendLogToContent('🔐 步骤5: 开始完成账号验证', 'info', { 
      step: 5,
      stepName: '完成验证',
      subStep: '开始',
      accountId: registrationResult.accountId
    });
    
    const verificationCompleteResult = await completeDreaminaVerification(registrationResult.accountId, verificationResult.code);
    if (!verificationCompleteResult.success) {
      await sendLogToContent('❌ 步骤5失败: 账号验证失败', 'error', { 
        step: 5,
        stepName: '完成验证',
        error: verificationCompleteResult.error
      });
      throw new Error(`账号验证失败: ${verificationCompleteResult.error}`);
    }
    
    await sendLogToContent('✅ 步骤5完成: 账号验证成功', 'success', { 
      step: 5,
      stepName: '完成验证',
      subStep: '完成'
    });
    
    // 流程完成
    await sendLogToContent('🎉 所有步骤完成！账号创建流程成功！', 'success', {
      finalAccount: {
        email: emailResult.email,
        password: emailResult.password,
        dreaminaId: registrationResult.accountId,
        verificationCode: verificationResult.code
      },
      totalSteps: 5,
      completedSteps: 5,
      timestamp: new Date().toISOString()
    });
    
    // 重置进度
    currentStep = 'completed';
    stepProgress = { current: 0, total: 0 };
    
    // 保存账号信息
    await chrome.storage.local.set({ 
      currentAccount: {
        email: emailResult.email,
        password: emailResult.password,
        dreaminaId: registrationResult.accountId,
        createdAt: new Date().toISOString()
      }
    });
    
    await sendLogToContent('💾 账号信息已保存到本地存储', 'success', { 
      saved: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // 记录详细错误信息
    console.error('Account creation failed:', error);
    console.error('Current step:', currentStep);
    console.error('Step progress:', stepProgress);
    
    // 如果是网络相关错误，提供解决建议
    let errorMessage = error.message;
    let suggestions = [];
    
    if (error.message.includes('0') || error.message.includes('fetch') || error.message.includes('network')) {
      suggestions.push('🌐 请使用扩展的"测试网络连接"功能检查网络状态');
      suggestions.push('🔍 检查邮箱管理后台服务器是否可访问');
      suggestions.push('📱 确认网络连接正常');
      
      // 运行请求头差异分析
      try {
        await sendLogToContent('🔍 检测到网络错误，正在运行请求头差异分析...', 'info', { 
          subStep: '请求头分析开始'
        });
        
        const headerAnalysis = await analyzeRequestHeaders();
        if (headerAnalysis) {
          await sendLogToContent('📊 请求头差异分析完成', 'info', { 
            headerAnalysis: headerAnalysis,
            subStep: '请求头分析完成'
          });
          
          // 添加到错误信息
          errorMessage += `\n\n🔍 请求头差异分析:\n${JSON.stringify(headerAnalysis.diff, null, 2)}`;
          errorMessage += `\n\n📋 缺失的重要请求头:\n${headerAnalysis.missingHeaders.join(', ')}`;
          
          suggestions.push('🔄 尝试使用"复制浏览器请求头"功能');
          suggestions.push('🔒 检查服务器是否设置了额外的安全策略');
          suggestions.push('🌐 验证服务器访问日志中的请求来源');
        }
      } catch (headerError) {
        await sendLogToContent(`⚠️ 请求头分析失败: ${headerError.message}`, 'warning', { 
          headerError: headerError.message,
          subStep: '请求头分析失败'
        });
      }
    }
    
    if (error.message.includes('Failed to fetch') || error.message.includes('邮箱账号创建失败')) {
      suggestions.push('📧 检查邮箱创建接口是否可访问');
      suggestions.push('🔑 确认CSRF Token是否正确');
      suggestions.push('📋 验证创建请求数据格式');
      suggestions.push('🔄 尝试重新登录邮箱管理后台');
    }
    
    if (error.message.includes('CORS') || error.message.includes('跨域')) {
      suggestions.push('🔒 检查扩展权限设置');
      suggestions.push('🔄 尝试重新加载扩展');
    }
    
    if (suggestions.length > 0) {
      errorMessage += '\n\n💡 解决建议:\n' + suggestions.join('\n');
    }
    
    await sendLogToContent(`💥 账号创建流程失败: ${errorMessage}`, 'error', { 
      error: error.message,
      step: currentStep,
      stepProgress: stepProgress,
      timestamp: new Date().toISOString(),
      suggestions: suggestions
    });
    
    currentStep = 'error';
    
    // 发送错误状态到popup
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateErrorStatus',
          error: errorMessage,
          step: currentStep,
          progress: stepProgress
        });
      }
    } catch (sendError) {
      console.error('Failed to send error status to popup:', sendError);
    }
  }
}

// 简化的消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);
  
  try {
    if (message.action === 'startMonitoring') {
      console.log("Starting monitoring...");
      isMonitoring = true;
      
      // 保存状态到存储
      chrome.storage.local.set({ isMonitoring: true });
      
      // 发送成功响应
      sendResponse({ success: true, message: "监控已启动" });
      
      // 开始真实的账号创建流程
      createRealAccount();
      
    } else if (message.action === 'stopMonitoring') {
      console.log("Stopping monitoring...");
      isMonitoring = false;
      currentStep = 'idle';
      stepProgress = { current: 0, total: 0 };
      
      // 保存状态到存储
      chrome.storage.local.set({ isMonitoring: false });
      
      // 发送成功响应
      sendResponse({ success: true, message: "监控已停止" });
      
      // 通知内容脚本停止
      sendLogToContent('监控已停止', 'warning');
      
    } else if (message.action === 'getStatus') {
      // 返回当前状态
      sendResponse({ 
        success: true, 
        isMonitoring: isMonitoring,
        currentStep: currentStep,
        progress: stepProgress,
        message: isMonitoring ? `监控运行中 - ${currentStep}` : "监控已停止"
      });
    } else if (message.action === 'getDetailedStatus') {
      // 返回详细状态
      sendResponse({
        success: true,
        isMonitoring: isMonitoring,
        currentStep: currentStep,
        progress: stepProgress,
        timestamp: new Date().toISOString()
      });
    } else if (message.action === 'manualNetworkTest') {
      // 手动网络测试
      console.log("Starting manual network test...");
      
      // 使用异步处理
      manualNetworkTest().then(testResults => {
        sendResponse({ success: true, results: testResults });
      }).catch(error => {
        console.error("Manual network test failed:", error);
        sendResponse({ success: false, error: error.message });
      });
      
      return true; // 保持消息通道开放
      
    } else if (message.action === 'testSpecificUrl') {
      // 测试特定URL
      const { url } = message;
      console.log(`Testing specific URL: ${url}`);
      
      // 使用异步处理
      testSpecificUrl(url).then(testResults => {
        sendResponse({ success: true, results: testResults });
      }).catch(error => {
        console.error("Specific URL test failed:", error);
        sendResponse({ success: false, error: error.message });
      });
      
      return true; // 保持消息通道开放
      
    } else if (message.action === 'testLoginRequest') {
      // 新增：测试登录请求
      console.log("🔐 Background script: Starting login request test...");
      
      // 使用异步处理
      testLoginRequest().then(testResults => {
        console.log("🔐 Background script: Login test completed:", testResults);
        sendResponse({ success: true, results: testResults });
      }).catch(error => {
        console.error("❌ Background script: Login request test failed:", error);
        sendResponse({ success: false, error: error.message });
      });
      
      return true; // 保持消息通道开放
      
    } else if (message.action === 'enableDebugMode') {
      // 🔍 启用调试模式
      console.log("🔍 Background script: Enabling debug mode...");
      
      try {
        // 启用调试模式
        DEBUG_CONFIG.enabled = true;
        DEBUG_CONFIG.showHeaders = true;
        DEBUG_CONFIG.showPageAnalysis = true;
        DEBUG_CONFIG.showCaptchaDetection = true;
        DEBUG_CONFIG.showRequestComparison = true;
        DEBUG_CONFIG.verboseLogging = true;
        
        // 保存调试配置到存储
        chrome.storage.local.set({ debugConfig: DEBUG_CONFIG });
        
        // 发送成功响应
        sendResponse({ 
          success: true, 
          message: "调试模式已启用",
          debugConfig: DEBUG_CONFIG
        });
        
        // 发送调试模式启用通知
        sendLogToContent('🔍 调试模式已启用，将显示详细的步骤信息', 'success');
        
        // 检查调试模式状态（异步执行）
        checkDebugModeStatus().catch(error => {
          console.error("Debug mode status check failed:", error);
        });
        
      } catch (error) {
        console.error("❌ Background script: Failed to enable debug mode:", error);
        sendResponse({ success: false, error: error.message });
      }
      
    } else if (message.action === 'disableDebugMode') {
      // 🔍 禁用调试模式
      console.log("🔍 Background script: Disabling debug mode...");
      
      try {
        // 禁用调试模式
        DEBUG_CONFIG.enabled = false;
        DEBUG_CONFIG.showHeaders = false;
        DEBUG_CONFIG.showPageAnalysis = false;
        DEBUG_CONFIG.showCaptchaDetection = false;
        DEBUG_CONFIG.showRequestComparison = false;
        DEBUG_CONFIG.verboseLogging = false;
        
        // 保存调试配置到存储
        chrome.storage.local.set({ debugConfig: DEBUG_CONFIG });
        
        // 发送成功响应
        sendResponse({ 
          success: true, 
          message: "调试模式已禁用",
          debugConfig: DEBUG_CONFIG
        });
        
        // 发送调试模式禁用通知
        sendLogToContent('🔍 调试模式已禁用', 'info');
        
      } catch (error) {
        console.error("❌ Background script: Failed to disable debug mode:", error);
        sendResponse({ success: false, error: error.message });
      }
      
    } else if (message.action === 'getDebugConfig') {
      // 🔍 获取调试配置
      console.log("🔍 Background script: Getting debug config...");
      
      try {
        sendResponse({ 
          success: true, 
          debugConfig: DEBUG_CONFIG
        });
      } catch (error) {
        console.error("❌ Background script: Failed to get debug config:", error);
        sendResponse({ success: false, error: error.message });
      }
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // 保持消息通道开放
});

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log("Dreamina自动注册扩展已安装");
  chrome.storage.local.set({ 
    isMonitoring: false
  });
});

// 启动时加载状态
chrome.runtime.onStartup.addListener(async () => {
  try {
    const { isMonitoring: savedMonitoring } = await chrome.storage.local.get(['isMonitoring']);
    if (savedMonitoring) {
      isMonitoring = savedMonitoring;
      console.log("恢复监控状态:", isMonitoring);
    }
  } catch (error) {
    console.error("Error loading startup state:", error);
  }
});

// 响应流管理工具
function createResponseWrapper(response) {
  let responseText = null;
  let responseJson = null;
  
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    text: async () => {
      if (responseText === null) {
        responseText = await response.text();
      }
      return responseText;
    },
    json: async () => {
      if (responseJson === null) {
        if (responseText === null) {
          responseText = await response.text();
        }
        responseJson = JSON.parse(responseText);
      }
      return responseJson;
    },
    clone: () => createResponseWrapper(response.clone())
  };
}

// Service Worker兼容的HTTP请求备选方案
function makeXHRRequest(url, method = 'GET', data = null, headers = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      // 在Service Worker中使用fetch API
      const fetchOptions = {
        method: method,
        headers: headers,
        cache: 'no-cache'
      };
      
      if (data && method !== 'GET') {
        fetchOptions.body = data;
      }
      
      const response = await fetch(url, fetchOptions);
      
      if (response.ok) {
        resolve({
          ok: true,
          status: response.status,
          statusText: response.statusText,
          text: () => response.text(),
          json: () => response.json(),
          headers: response.headers
        });
      } else {
        reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
      }
    } catch (error) {
      reject(new Error(`Request failed: ${error.message}`));
    }
  });
}

// 请求头差异分析诊断
async function analyzeRequestHeaders() {
  try {
    await sendLogToContent('🔍 开始分析请求头差异...', 'info', { subStep: '请求头分析' });
    
    // 使用统一的BROWSER_HEADERS常量
    const browserHeaders = BROWSER_HEADERS;
    
    // 当前扩展使用的headers - 使用实际的BROWSER_HEADERS
    const extensionHeaders = {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': EMAIL_CONFIG.loginUrl
    };
    
    // 比较差异
    const diff = {};
    const missingHeaders = [];
    
    for (const [key, value] of Object.entries(browserHeaders)) {
      if (!extensionHeaders[key]) {
        missingHeaders.push(key);
        diff[key] = {
          extension: '缺失',
          browser: value,
          importance: getHeaderImportance(key)
        };
      }
    }
    
    await sendLogToContent('📊 请求头差异分析完成', 'info', { 
      headerDiff: diff,
      missingHeaders: missingHeaders,
      subStep: '分析完成'
    });
    
    return {
      diff: diff,
      missingHeaders: missingHeaders,
      browserHeaders: browserHeaders,
      extensionHeaders: extensionHeaders
    };
    
  } catch (error) {
    await sendLogToContent(`⚠️ 请求头分析失败: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '分析失败'
    });
    return null;
  }
}

// 获取请求头重要性
function getHeaderImportance(headerName) {
  const importance = {
    'User-Agent': '高',
    'Accept': '中',
    'Accept-Language': '中',
    'Sec-Fetch-Dest': '高',
    'Sec-Fetch-Mode': '高',
    'Sec-Fetch-Site': '高',
    'Sec-Fetch-User': '高',
    'Upgrade-Insecure-Requests': '中',
    'Connection': '低'
  };
  
  return importance[headerName] || '低';
}

// 新增：测试登录请求函数
async function testLoginRequest() {
  try {
    await sendLogToContent('🧪 开始测试登录请求...', 'info', { subStep: '测试开始' });
    
    // 第一步：获取登录页面，分析表单结构
    await sendLogToContent('📄 第一步：获取登录页面...', 'info', { subStep: '获取页面' });
    
    const pageResponse = await fetch(EMAIL_CONFIG.loginUrl, {
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    
    if (!pageResponse.ok) {
      throw new Error(`获取页面失败: ${pageResponse.status} ${pageResponse.statusText}`);
    }
    
    const pageHtml = await pageResponse.text();
    await sendLogToContent(`📄 页面获取成功，长度: ${pageHtml.length} 字符`, 'info', { 
      pageLength: pageHtml.length,
      subStep: '页面获取'
    });
    
    // 分析页面结构
    const hasLoginForm = pageHtml.includes('form') && pageHtml.includes('input');
    const hasUsernameField = pageHtml.includes('username') || pageHtml.includes('用户名');
    const hasPasswordField = pageHtml.includes('password') || pageHtml.includes('密码');
    const hasCaptchaField = pageHtml.includes('captcha') || pageHtml.includes('验证码') || pageHtml.includes('code');
    const hasSubmitButton = pageHtml.includes('submit') || pageHtml.includes('登录') || pageHtml.includes('login');
    
    await sendLogToContent(`🔍 表单结构分析: 表单=${hasLoginForm}, 用户名字段=${hasUsernameField}, 密码字段=${hasPasswordField}, 验证码字段=${hasCaptchaField}, 提交按钮=${hasSubmitButton}`, 'info', {
      hasLoginForm,
      hasUsernameField,
      hasPasswordField,
      hasCaptchaField,
      hasSubmitButton,
      subStep: '表单分析'
    });
    
    // 检查是否有CSRF token或其他隐藏字段
    const hasCsrfToken = pageHtml.includes('csrf') || pageHtml.includes('token') || pageHtml.includes('_token');
    const hasHiddenFields = pageHtml.includes('input type="hidden"');
    
    await sendLogToContent(`🔐 安全字段检查: CSRF=${hasCsrfToken}, 隐藏字段=${hasHiddenFields}`, 'info', {
      hasCsrfToken,
      hasHiddenFields,
      subStep: '安全字段检查'
    });
    
    // 第二步：如果不需要验证码，直接测试登录
    if (!hasCaptchaField) {
      await sendLogToContent('🔓 无需验证码，直接测试登录...', 'info', { subStep: '无验证码登录' });
      
      const testLoginData = new URLSearchParams();
      testLoginData.append('username', EMAIL_CONFIG.adminCredentials.username);
      testLoginData.append('password', EMAIL_CONFIG.adminCredentials.password);
      
      const testResponse = await fetch(EMAIL_CONFIG.loginUrl, {
        method: 'POST',
        headers: {
          ...BROWSER_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: testLoginData.toString()
      });
      
      const responseText = await testResponse.text();
      const hasSuccess = responseText.includes('dashboard') || responseText.includes('logout') || responseText.includes('欢迎');
      const stillOnLoginPage = responseText.includes('login') || responseText.includes('用户名') || responseText.includes('密码');
      
      await sendLogToContent(`🔍 登录结果: 成功=${hasSuccess}, 仍在登录页=${stillOnLoginPage}`, 'info', { 
        hasSuccess,
        stillOnLoginPage,
        subStep: '登录测试'
      });
      
      return {
        success: true,
        status: testResponse.status,
        hasSuccess,
        stillOnLoginPage,
        needsCaptcha: false,
        contentLength: responseText.length
      };
    }
    
    // 第三步：需要验证码，分析验证码图片
    await sendLogToContent('🖼️ 需要验证码，分析验证码图片...', 'info', { subStep: '验证码分析' });
    
    // 增强的验证码图片查找逻辑
    let captchaUrl = null;
    let captchaImgMatch = null;
    
    // 方法1：查找包含captcha的图片
    captchaImgMatch = pageHtml.match(/<img[^>]*src=["']([^"']*captcha[^"']*)["'][^>]*>/i);
    if (captchaImgMatch) {
      captchaUrl = captchaImgMatch[1];
      await sendLogToContent(`🖼️ 方法1找到验证码图片: ${captchaUrl}`, 'info', { 
        method: 'captcha关键词',
        captchaUrl: captchaUrl,
        subStep: '验证码URL查找'
      });
    }
    
    // 方法2：查找包含code的图片
    if (!captchaUrl) {
      captchaImgMatch = pageHtml.match(/<img[^>]*src=["']([^"']*code[^"']*)["'][^>]*>/i);
      if (captchaImgMatch) {
        captchaUrl = captchaImgMatch[1];
        await sendLogToContent(`🖼️ 方法2找到验证码图片: ${captchaUrl}`, 'info', { 
          method: 'code关键词',
          captchaUrl: captchaUrl,
          subStep: '验证码URL查找'
        });
      }
    }
    
    // 方法3：查找包含验证码的图片
    if (!captchaUrl) {
      captchaImgMatch = pageHtml.match(/<img[^>]*src=["']([^"']*验证码[^"']*)["'][^>]*>/i);
      if (captchaImgMatch) {
        captchaUrl = captchaImgMatch[1];
        await sendLogToContent(`🖼️ 方法3找到验证码图片: ${captchaUrl}`, 'info', { 
          method: '验证码中文关键词',
          captchaUrl: captchaUrl,
          subStep: '验证码URL查找'
        });
      }
    }
    
    // 方法4：查找所有图片，分析可能的图片标签
    if (!captchaUrl) {
      await sendLogToContent('🔍 方法4：分析所有图片标签...', 'info', { subStep: '图片标签分析' });
      
      const allImgTags = pageHtml.match(/<img[^>]*>/gi);
      if (allImgTags) {
        await sendLogToContent(`📸 找到 ${allImgTags.length} 个图片标签`, 'info', { 
          imgCount: allImgTags.length,
          subStep: '图片标签统计'
        });
        
        // 分析每个图片标签
        for (let i = 0; i < Math.min(allImgTags.length, 10); i++) {
          const imgTag = allImgTags[i];
          const srcMatch = imgTag.match(/src=["']([^"']*)["']/i);
          if (srcMatch) {
            const src = srcMatch[1];
            await sendLogToContent(`📸 图片${i+1}: ${src}`, 'info', { 
              imgIndex: i+1,
              imgSrc: src,
              imgTag: imgTag.substring(0, 100),
              subStep: '图片标签分析'
            });
            
            // 检查是否可能是验证码图片
            if (src.includes('captcha') || src.includes('code') || src.includes('验证码') || 
                src.includes('image') || src.includes('img') || src.includes('pic')) {
              captchaUrl = src;
              await sendLogToContent(`🎯 方法4找到可能的验证码图片: ${captchaUrl}`, 'info', { 
                method: '图片标签分析',
                captchaUrl: captchaUrl,
                subStep: '验证码URL查找'
              });
              break;
            }
          }
        }
      }
    }
    
    // 方法5：尝试常见的验证码API端点
    if (!captchaUrl) {
      await sendLogToContent('🔍 方法5：尝试常见验证码API端点...', 'info', { subStep: 'API端点尝试' });
      
      const commonCaptchaEndpoints = [
        '/captcha',
        '/captcha.php',
        '/captcha.jpg',
        '/captcha.png',
        '/captcha/generate',
        '/api/captcha',
        '/verify/captcha',
        '/login/captcha',
        '/user/captcha'
      ];
      
      for (const endpoint of commonCaptchaEndpoints) {
        const testUrl = `${EMAIL_CONFIG.adminUrl}${endpoint}`;
        await sendLogToContent(`🔗 尝试端点: ${testUrl}`, 'info', { 
          endpoint: endpoint,
          testUrl: testUrl,
          subStep: 'API端点测试'
        });
        
        try {
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: BROWSER_HEADERS
          });
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('image/')) {
              captchaUrl = testUrl;
              await sendLogToContent(`✅ 方法5找到验证码图片: ${captchaUrl}`, 'info', { 
                method: 'API端点测试',
                captchaUrl: captchaUrl,
                contentType: contentType,
                subStep: '验证码URL查找'
              });
              break;
            }
          }
        } catch (error) {
          await sendLogToContent(`⚠️ 端点 ${endpoint} 测试失败: ${error.message}`, 'warning', { 
            endpoint: endpoint,
            error: error.message,
            subStep: 'API端点测试'
          });
        }
      }
    }
    
    // 方法6：分析HTML中的JavaScript代码，查找验证码生成逻辑
    if (!captchaUrl) {
      await sendLogToContent('🔍 方法6：分析JavaScript代码...', 'info', { subStep: 'JavaScript分析' });
      
      // 查找可能的验证码相关JavaScript代码
      const jsPatterns = [
        /captcha\.php/gi,
        /captcha\.jpg/gi,
        /captcha\.png/gi,
        /\/captcha\//gi,
        /captchaUrl/gi,
        /captchaSrc/gi,
        /验证码/gi
      ];
      
      for (const pattern of jsPatterns) {
        const matches = pageHtml.match(pattern);
        if (matches) {
          await sendLogToContent(`🔍 JavaScript模式匹配: ${pattern.source}`, 'info', { 
            pattern: pattern.source,
            matches: matches.length,
            subStep: 'JavaScript分析'
          });
        }
      }
      
      // 查找script标签中的内容
      const scriptTags = pageHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      if (scriptTags) {
        await sendLogToContent(`📜 找到 ${scriptTags.length} 个script标签`, 'info', { 
          scriptCount: scriptTags.length,
          subStep: 'JavaScript分析'
        });
        
        for (let i = 0; i < Math.min(scriptTags.length, 5); i++) {
          const scriptContent = scriptTags[i];
          if (scriptContent.includes('captcha') || scriptContent.includes('验证码')) {
            await sendLogToContent(`📜 Script${i+1}包含验证码相关代码`, 'info', { 
              scriptIndex: i+1,
              scriptPreview: scriptContent.substring(0, 200),
              subStep: 'JavaScript分析'
            });
          }
        }
      }
    }
    
    // 方法7：尝试直接访问验证码生成端点
    if (!captchaUrl) {
      await sendLogToContent('🔍 方法7：尝试直接访问验证码生成端点...', 'info', { subStep: '直接访问端点' });
      
      // 基于邮箱管理系统的常见验证码端点
      const captchaEndpoints = [
        '/captcha',
        '/captcha.php',
        '/captcha.jpg',
        '/captcha.png',
        '/captcha/generate',
        '/api/captcha',
        '/verify/captcha',
        '/login/captcha',
        '/user/captcha',
        '/Center/captcha',
        '/Index/captcha',
        '/Users/captcha'
      ];
      
      for (const endpoint of captchaEndpoints) {
        const testUrl = `${EMAIL_CONFIG.adminUrl}${endpoint}`;
        await sendLogToContent(`🔗 尝试端点: ${testUrl}`, 'info', { 
          endpoint: endpoint,
          testUrl: testUrl,
          subStep: '端点测试'
        });
        
        try {
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: BROWSER_HEADERS
          });
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            await sendLogToContent(`📊 端点响应: ${response.status} ${response.statusText}, 内容类型: ${contentType}`, 'info', { 
              endpoint: endpoint,
              status: response.status,
              contentType: contentType,
              subStep: '端点测试'
            });
            
            if (contentType && contentType.startsWith('image/')) {
              captchaUrl = testUrl;
              await sendLogToContent(`✅ 方法7找到验证码图片: ${captchaUrl}`, 'info', { 
                method: '直接访问端点',
                captchaUrl: captchaUrl,
                contentType: contentType,
                subStep: '验证码URL查找'
              });
              break;
            }
          }
        } catch (error) {
          await sendLogToContent(`⚠️ 端点 ${endpoint} 测试失败: ${error.message}`, 'warning', { 
            endpoint: endpoint,
            error: error.message,
            subStep: '端点测试'
          });
        }
      }
    }
    
    if (captchaUrl) {
      // 如果是相对URL，转换为绝对URL
      const fullCaptchaUrl = captchaUrl.startsWith('http') ? captchaUrl : `${EMAIL_CONFIG.adminUrl}${captchaUrl}`;
      await sendLogToContent(`🖼️ 最终验证码图片URL: ${fullCaptchaUrl}`, 'info', { 
        originalUrl: captchaUrl,
        fullUrl: fullCaptchaUrl,
        subStep: '验证码URL确定'
      });
      
      // 尝试识别验证码
      await sendLogToContent('🔍 尝试识别验证码...', 'info', { subStep: '验证码识别' });
      
      try {
        // 先下载验证码图片
        await sendLogToContent('📥 正在下载验证码图片...', 'info', { 
          imageUrl: fullCaptchaUrl,
          subStep: '图片下载'
        });
        
        const imageResponse = await fetch(fullCaptchaUrl, {
          method: 'GET',
          headers: BROWSER_HEADERS
        });
        
        if (!imageResponse.ok) {
          throw new Error(`图片下载失败: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        
        const imageBlob = await imageResponse.blob();
        await sendLogToContent(`✅ 验证码图片下载成功，大小: ${imageBlob.size} 字节`, 'info', { 
          imageSize: imageBlob.size,
          imageType: imageBlob.type,
          subStep: '图片下载完成'
        });
        
        // 使用下载的图片进行OCR识别
        const ocrResult = await bingtopOCR(imageBlob);
        if (ocrResult.success) {
          await sendLogToContent(`✅ 验证码识别成功: ${ocrResult.code}`, 'info', { 
            captchaCode: ocrResult.code,
            confidence: ocrResult.confidence,
            subStep: '验证码识别成功'
          });
          
          // 第四步：使用识别出的验证码进行登录测试
          await sendLogToContent('🔐 使用验证码测试登录...', 'info', { subStep: '验证码登录测试' });
          
          // 分析登录表单，找出正确的字段名
          await sendLogToContent('🔍 分析登录表单字段...', 'info', { subStep: '表单字段分析' });
          
          // 查找可能的验证码字段名
          const captchaFieldPatterns = [
            /name=["']([^"']*captcha[^"']*)["']/i,
            /name=["']([^"']*code[^"']*)["']/i,
            /name=["']([^"']*验证码[^"']*)["']/i,
            /name=["']([^"']*verify[^"']*)["']/i
          ];
          
          let captchaFieldName = 'captcha'; // 默认字段名
          for (const pattern of captchaFieldPatterns) {
            const match = pageHtml.match(pattern);
            if (match) {
              captchaFieldName = match[1];
              await sendLogToContent(`🔍 找到验证码字段名: ${captchaFieldName}`, 'info', { 
                fieldName: captchaFieldName,
                pattern: pattern.source,
                subStep: '字段名查找'
              });
              break;
            }
          }
          
          // 查找其他可能的隐藏字段
          const hiddenFieldMatches = pageHtml.match(/<input[^>]*type=["']hidden["'][^>]*>/gi);
          const hiddenFields = {};
          if (hiddenFieldMatches) {
            await sendLogToContent(`🔍 找到 ${hiddenFieldMatches.length} 个隐藏字段`, 'info', { 
              hiddenFieldCount: hiddenFieldMatches.length,
              subStep: '隐藏字段分析'
            });
            
            for (const hiddenField of hiddenFieldMatches) {
              const nameMatch = hiddenField.match(/name=["']([^"']*)["']/i);
              const valueMatch = hiddenField.match(/value=["']([^"']*)["']/i);
              if (nameMatch) {
                const name = nameMatch[1];
                const value = valueMatch ? valueMatch[1] : '';
                hiddenFields[name] = value;
                await sendLogToContent(`🔍 隐藏字段: ${name} = ${value}`, 'info', { 
                  fieldName: name,
                  fieldValue: value,
                  subStep: '隐藏字段分析'
                });
              }
            }
          }
          
          // 构建完整的登录数据
          const testLoginData = new URLSearchParams();
          testLoginData.append('username', EMAIL_CONFIG.adminCredentials.username);
          testLoginData.append('password', EMAIL_CONFIG.adminCredentials.password);
          testLoginData.append(captchaFieldName, ocrResult.code);
          
          // 添加所有隐藏字段
          for (const [name, value] of Object.entries(hiddenFields)) {
            testLoginData.append(name, value);
          }
          
          await sendLogToContent(`📋 完整登录数据: ${testLoginData.toString()}`, 'info', { 
            loginData: testLoginData.toString(),
            captchaFieldName: captchaFieldName,
            hiddenFields: Object.keys(hiddenFields),
            subStep: '登录数据构建'
          });
          
          const testResponse = await fetch(EMAIL_CONFIG.loginUrl, {
            method: 'POST',
            headers: {
              ...BROWSER_HEADERS,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: testLoginData.toString()
          });
          
          await sendLogToContent(`📊 登录响应: ${testResponse.status} ${testResponse.statusText}`, 'info', { 
            status: testResponse.status,
            statusText: testResponse.statusText,
            subStep: '登录响应'
          });
          
          const responseText = await testResponse.text();
          const hasSuccess = responseText.includes('dashboard') || responseText.includes('logout') || responseText.includes('欢迎');
          const stillOnLoginPage = responseText.includes('login') || responseText.includes('用户名') || responseText.includes('密码');
          
          // 分析响应内容
          const hasError = responseText.includes('错误') || responseText.includes('失败') || responseText.includes('invalid');
          const hasCaptchaError = responseText.includes('验证码') && (responseText.includes('错误') || responseText.includes('失败'));
          
          await sendLogToContent(`🔍 验证码登录结果: 成功=${hasSuccess}, 仍在登录页=${stillOnLoginPage}, 有错误=${hasError}, 验证码错误=${hasCaptchaError}`, 'info', { 
            hasSuccess,
            stillOnLoginPage,
            hasError,
            hasCaptchaError,
            responseLength: responseText.length,
            subStep: '登录结果分析'
          });
          
          // 如果仍然失败，尝试不同的验证码字段名
          if (!hasSuccess && !hasCaptchaError) {
            await sendLogToContent('🔄 尝试其他验证码字段名...', 'info', { subStep: '字段名重试' });
            
            const alternativeFieldNames = ['code', 'verify', 'verification', 'imgcode'];
            for (const altFieldName of alternativeFieldNames) {
              if (altFieldName !== captchaFieldName) {
                await sendLogToContent(`🔄 尝试字段名: ${altFieldName}`, 'info', { 
                  alternativeField: altFieldName,
                  subStep: '字段名重试'
                });
                
                const retryLoginData = new URLSearchParams();
                retryLoginData.append('username', EMAIL_CONFIG.adminCredentials.username);
                retryLoginData.append('password', EMAIL_CONFIG.adminCredentials.password);
                retryLoginData.append(altFieldName, ocrResult.code);
                
                // 添加隐藏字段
                for (const [name, value] of Object.entries(hiddenFields)) {
                  retryLoginData.append(name, value);
                }
                
                try {
                  const retryResponse = await fetch(EMAIL_CONFIG.loginUrl, {
                    method: 'POST',
                    headers: {
                      ...BROWSER_HEADERS,
                      'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: retryLoginData.toString()
                  });
                  
                  const retryResponseText = await retryResponse.text();
                  const retryHasSuccess = retryResponseText.includes('dashboard') || retryResponseText.includes('logout') || retryResponseText.includes('欢迎');
                  const retryStillOnLoginPage = retryResponseText.includes('login') || retryResponseText.includes('用户名') || retryResponseText.includes('密码');
                  
                  await sendLogToContent(`🔄 重试结果(${altFieldName}): 成功=${retryHasSuccess}, 仍在登录页=${retryStillOnLoginPage}`, 'info', { 
                    fieldName: altFieldName,
                    hasSuccess: retryHasSuccess,
                    stillOnLoginPage: retryStillOnLoginPage,
                    subStep: '字段名重试'
                  });
                  
                  if (retryHasSuccess) {
                    await sendLogToContent(`✅ 使用字段名 ${altFieldName} 登录成功！`, 'success', { 
                      successfulField: altFieldName,
                      subStep: '重试成功'
                    });
                    
                    return {
                      success: true,
                      status: retryResponse.status,
                      hasSuccess: true,
                      stillOnLoginPage: false,
                      needsCaptcha: true,
                      captchaCode: ocrResult.code,
                      successfulFieldName: altFieldName,
                      contentLength: retryResponseText.length
                    };
                  }
                } catch (retryError) {
                  await sendLogToContent(`⚠️ 重试字段名 ${altFieldName} 失败: ${retryError.message}`, 'warning', { 
                    fieldName: altFieldName,
                    error: retryError.message,
                    subStep: '字段名重试'
                  });
                }
              }
            }
          }
          
          return {
            success: true,
            status: testResponse.status,
            hasSuccess,
            stillOnLoginPage,
            needsCaptcha: true,
            captchaCode: ocrResult.code,
            captchaFieldName: captchaFieldName,
            hiddenFields: Object.keys(hiddenFields),
            contentLength: responseText.length
          };
          
        } else {
          await sendLogToContent(`❌ 验证码识别失败: ${ocrResult.error}`, 'warning', { 
            error: ocrResult.error,
            subStep: '验证码识别失败'
          });
          
          return {
            success: false,
            needsCaptcha: true,
            error: `验证码识别失败: ${ocrResult.error}`,
            captchaUrl: fullCaptchaUrl
          };
        }
      } catch (ocrError) {
        await sendLogToContent(`❌ 验证码识别过程出错: ${ocrError.message}`, 'error', { 
          error: ocrError.message,
          subStep: '验证码识别错误'
        });
        
        return {
          success: false,
          needsCaptcha: true,
          error: `验证码识别错误: ${ocrError.message}`,
          captchaUrl: fullCaptchaUrl
        };
      }
      
    } else {
      await sendLogToContent('❌ 未找到验证码图片URL', 'warning', { subStep: '验证码URL未找到' });
      return {
        success: false,
        needsCaptcha: true,
        error: '未找到验证码图片URL'
      };
    }
    
  } catch (error) {
    await sendLogToContent(`❌ 测试登录请求失败: ${error.message}`, 'error', {
      error: error.message,
      subStep: '测试失败'
    });
    return {
      success: false,
      error: error.message
    };
  }
}

// 会话验证函数 - 修复为严格的登录状态检查，避免重复读取Response body
async function verifySession(sessionId) {
  try {
    await sendLogToContent('🔐 正在严格验证登录状态...', 'info', { subStep: '登录状态验证' });
    
    // 方法1: 检查登录页面是否仍然存在（如果仍在登录页，说明登录失败）
    const loginPageResponse = await fetch(`${EMAIL_CONFIG.adminUrl}/Center/Index/login`, {
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    
    if (loginPageResponse.ok) {
      const loginPageText = await loginPageResponse.text();
      // 如果页面包含登录表单，说明仍在登录页
      if (loginPageText.includes('登录') || loginPageText.includes('username') || loginPageText.includes('password')) {
        await sendLogToContent('❌ 仍在登录页面，登录失败', 'error', { 
          subStep: '登录状态验证失败',
          reason: '仍在登录页面'
        });
        return false;
      }
    }
    
    // 方法2: 尝试访问需要登录的页面
    const protectedPageResponse = await fetch(`${EMAIL_CONFIG.adminUrl}/Users`, {
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    
    if (!protectedPageResponse.ok) {
      await sendLogToContent('❌ 无法访问受保护页面，登录失败', 'error', { 
        subStep: '登录状态验证失败',
        reason: '无法访问受保护页面',
        status: protectedPageResponse.status
      });
      return false;
    }
    
    const protectedPageText = await protectedPageResponse.text();
    
    // 检查是否被重定向到登录页
    if (protectedPageText.includes('登录') || protectedPageText.includes('username') || protectedPageText.includes('password')) {
      await sendLogToContent('❌ 被重定向到登录页，登录失败', 'error', { 
        subStep: '登录状态验证失败',
        reason: '被重定向到登录页'
      });
      return false;
    }
    
    // 检查是否包含管理功能内容
    if (!protectedPageText.includes('用户管理') && !protectedPageText.includes('邮箱管理') && !protectedPageText.includes('管理')) {
      await sendLogToContent('❌ 页面内容不符合预期，登录失败', 'error', { 
        subStep: '登录状态验证失败',
        reason: '页面内容不符合预期'
      });
      return false;
    }
    
    await sendLogToContent('✅ 登录状态验证成功', 'success', { 
      subStep: '登录状态验证成功'
    });
    return true;
    
  } catch (error) {
    await sendLogToContent(`❌ 登录状态验证错误: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '验证错误'
    });
    return false;
  }
}

console.log("简化版background script已加载");

// 生成唯一邮箱地址
function generateUniqueEmail() {
  // 生成精确的时间戳格式：年月日时分秒
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  // 生成时间戳字符串：20241220143052（纯数字，无特殊符号）
  const timeString = `${year}${month}${day}${hours}${minutes}${seconds}`;
  
  // 生成随机字符串：6位数字+字母组合
  const randomString = Math.random().toString(36).substring(2, 8);
  
  // 生成唯一邮箱地址：年月日时分秒加随机字母@tiktokaccu.com（无特殊符号）
  const email = `${timeString}${randomString}@tiktokaccu.com`;
  
  return {
    email: email,
    timeString: timeString,
    randomString: randomString
  };
}

// 生成符合要求的复杂密码
function generateComplexPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // 确保包含至少一个大写字母
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  // 确保包含至少一个小写字母
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  // 确保包含至少一个数字
  password += '0123456789'[Math.floor(Math.random() * 10)];
  // 确保包含至少一个特殊字符
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
  
  // 填充剩余字符到12-16位
  const remainingLength = Math.floor(Math.random() * 5) + 8; // 8-12位
  for (let i = 0; i < remainingLength; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // 打乱密码字符顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// 重新登录邮箱管理系统
async function reloginEmailAdmin() {
  try {
    await sendLogToContent('🔄 开始重新登录邮箱管理系统...', 'info', { 
      subStep: '重新登录'
    });
    
    // 使用现有的登录逻辑
    const loginResult = await loginToEmailAdmin();
    
    if (loginResult.success) {
      await sendLogToContent('✅ 重新登录成功', 'success', { 
        subStep: '重新登录完成'
      });
      return true;
    } else {
      await sendLogToContent('❌ 重新登录失败', 'error', { 
        error: loginResult.error,
        subStep: '重新登录失败'
      });
      return false;
    }
    
  } catch (error) {
    await sendLogToContent(`❌ 重新登录过程出错: ${error.message}`, 'error', { 
      error: error.message,
      subStep: '重新登录错误'
    });
    return false;
  }
}

// 验证邮箱是否真的被创建
async function verifyEmailCreation(email) {
  try {
    await sendLogToContent('🔍 开始验证邮箱创建状态...', 'info', { 
      email: email,
      subStep: '邮箱验证'
    });
    
    // 等待一段时间让服务器处理完成
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 尝试访问用户管理页面，查看是否包含新创建的邮箱
    const userListUrl = `${EMAIL_CONFIG.adminUrl}/Users`;
    
    const response = await fetch(userListUrl, {
      method: 'GET',
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${EMAIL_CONFIG.adminUrl}/Index/login`
      }
    });
    
    if (!response.ok) {
      await sendLogToContent('⚠️ 无法访问用户管理页面进行验证', 'warning', { 
        status: response.status,
        subStep: '页面访问失败'
      });
      return false;
    }
    
    const pageContent = await response.text();
    
    // 检查页面是否包含新创建的邮箱
    const emailExists = pageContent.includes(email);
    
    if (emailExists) {
      await sendLogToContent('✅ 邮箱创建验证成功，在用户列表中找到新邮箱', 'success', { 
        email: email,
        subStep: '验证成功'
      });
      return true;
    } else {
      await sendLogToContent('❌ 邮箱创建验证失败，在用户列表中未找到新邮箱', 'error', { 
        email: email,
        pageContentLength: pageContent.length,
        subStep: '验证失败'
      });
      
      // 记录页面内容片段用于调试
      await sendLogToContent('📄 用户列表页面内容片段:', 'info', { 
        pageContentPreview: pageContent.substring(0, 500),
        subStep: '页面内容分析'
      });
      
      return false;
    }
    
  } catch (error) {
    await sendLogToContent(`❌ 邮箱创建验证过程出错: ${error.message}`, 'error', { 
      error: error.message,
      email: email,
      subStep: '验证错误'
    });
    return false;
  }
}

// 验证邮箱创建响应是否真正成功
async function validateEmailCreationResponse(responseContent, createUrl) {
  try {
    await sendLogToContent('🔍 开始验证邮箱创建响应...', 'info', { 
      createUrl: createUrl,
      responseLength: responseContent.length,
      subStep: '响应验证'
    });
    
    // 检查响应内容长度
    if (responseContent.length < 10) {
      await sendLogToContent('⚠️ 响应内容过短，可能不是有效响应', 'warning', { 
        responseLength: responseContent.length,
        subStep: '内容长度检查'
      });
      return false;
    }
    
    // 检查是否包含成功相关的关键词
    const successIndicators = [
      'success', '成功', 'Success', 'SUCCESS',
      'created', '创建成功', '添加成功', '添加完成',
      '用户创建成功', '邮箱创建成功', '操作成功',
      'redirect', '重定向', '跳转'
    ];
    
    const hasSuccessIndicator = successIndicators.some(indicator => 
      responseContent.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // 检查是否包含错误相关的关键词
    const errorIndicators = [
      'error', '错误', 'Error', 'ERROR',
      'failed', '失败', 'Failed', 'FAILED',
      '创建失败', '添加失败', '操作失败',
      'already exists', '已存在', '重复',
      'invalid', '无效', 'Invalid'
    ];
    
    const hasErrorIndicator = errorIndicators.some(indicator => 
      responseContent.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // 检查是否包含表单（如果返回表单，说明可能还在创建页面）
    const hasForm = responseContent.includes('<form') || responseContent.includes('<input');
    
    // 检查是否包含登录页面（如果返回登录页，说明会话过期）
    const hasLoginPage = responseContent.includes('登录') || responseContent.includes('login') || 
                        responseContent.includes('用户名') || responseContent.includes('password') ||
                        responseContent.includes('Login') || responseContent.includes('LOGIN') ||
                        responseContent.includes('用户登录') || responseContent.includes('管理员登录');
    
    // 分析结果
    const validationResult = {
      hasSuccessIndicator,
      hasErrorIndicator,
      hasForm,
      hasLoginPage,
      responseLength: responseContent.length,
      responsePreview: responseContent.substring(0, 200)
    };
    
    await sendLogToContent('🔍 响应验证结果:', 'info', { 
      validationResult: validationResult,
      subStep: '验证结果'
    });
    
    // 判断是否真正成功
    if (hasErrorIndicator) {
      await sendLogToContent('❌ 响应包含错误信息，创建失败', 'error', { 
        errorIndicators: errorIndicators.filter(indicator => 
          responseContent.toLowerCase().includes(indicator.toLowerCase())
        ),
        subStep: '错误检测'
      });
      return false;
    }
    
    if (hasLoginPage) {
      await sendLogToContent('❌ 响应包含登录页面，会话可能过期', 'error', { 
        subStep: '会话检查'
      });
      return false;
    }
    
    if (hasForm && !hasSuccessIndicator) {
      // 进一步分析表单内容，检查是否是邮箱创建表单
      const isEmailCreationForm = await analyzeEmailForm(responseContent, createUrl);
      
      if (isEmailCreationForm.hasEmailInput && isEmailCreationForm.hasPasswordInput) {
        await sendLogToContent('✅ 响应包含邮箱创建表单，可能创建成功', 'success', { 
          formAnalysis: isEmailCreationForm,
          subStep: '表单分析'
        });
        return true;
      } else {
        await sendLogToContent('⚠️ 响应包含表单但无成功指示，可能仍在创建页面', 'warning', { 
          formAnalysis: isEmailCreationForm,
          subStep: '表单检查'
        });
        return false;
      }
    }
    
    if (hasSuccessIndicator) {
      await sendLogToContent('✅ 响应包含成功指示，创建成功', 'success', { 
        successIndicators: successIndicators.filter(indicator => 
          responseContent.toLowerCase().includes(indicator.toLowerCase())
        ),
        subStep: '成功检测'
      });
      return true;
    }
    
    // 如果没有明确的成功/失败指示，进行进一步分析
    await sendLogToContent('⚠️ 响应无明确指示，进行进一步分析', 'warning', { 
      subStep: '进一步分析'
    });
    
    // 检查响应是否包含邮箱列表或用户管理页面
    const hasUserManagement = responseContent.includes('用户管理') || 
                             responseContent.includes('用户列表') || 
                             responseContent.includes('邮箱列表') ||
                             responseContent.includes('user management') ||
                             responseContent.includes('user list');
    
    if (hasUserManagement) {
      await sendLogToContent('✅ 响应包含用户管理页面，可能创建成功', 'success', { 
        subStep: '页面内容分析'
      });
      return true;
    }
    
    // 默认情况下，如果响应很长且没有错误，认为可能成功
    if (responseContent.length > 500 && !hasErrorIndicator) {
      await sendLogToContent('⚠️ 响应较长且无错误，可能创建成功（需要进一步验证）', 'warning', { 
        subStep: '默认判断'
      });
      return true;
    }
    
    await sendLogToContent('❌ 响应验证失败，无法确定创建状态', 'error', { 
      subStep: '验证失败'
    });
    return false;
    
  } catch (error) {
    await sendLogToContent(`❌ 响应验证过程出错: ${error.message}`, 'error', { 
      error: error.message,
      createUrl: createUrl,
      subStep: '验证错误'
    });
    return false;
  }
}

// 分析表单提交机制
function analyzeFormSubmission(pageContent) {
  try {
    // 查找表单标签
    const formMatch = pageContent.match(/<form[^>]*>/i);
    
    // 查找提交按钮
    const submitButtonMatch = pageContent.match(/<button[^>]*type="submit"[^>]*>/i);
    
    // 查找表单的action属性
    const actionMatch = formMatch ? formMatch[0].match(/action="([^"]*)"/i) : null;
    const actionUrl = actionMatch ? actionMatch[1] : null;
    
    // 查找表单的method属性
    const methodMatch = formMatch ? formMatch[0].match(/method="([^"]*)"/i) : null;
    const method = methodMatch ? methodMatch[1].toUpperCase() : 'POST';
    
    // 分析提交按钮
    const buttonAnalysis = submitButtonMatch ? {
      hasSubmitButton: true,
      buttonHtml: submitButtonMatch[0],
      buttonId: submitButtonMatch[0].match(/id="([^"]*)"/i)?.[1] || null,
      buttonClass: submitButtonMatch[0].match(/class="([^"]*)"/i)?.[1] || null,
      buttonText: submitButtonMatch[0].replace(/<[^>]*>/g, '').trim()
    } : {
      hasSubmitButton: false
    };
    
    return {
      hasForm: !!formMatch,
      formAction: actionUrl,
      formMethod: method,
      ...buttonAnalysis
    };
    
  } catch (error) {
    console.error('表单提交分析失败:', error);
    return {
      hasForm: false,
      error: error.message
    };
  }
}

// 增强的邮箱表单分析函数
async function analyzeEmailForm(pageContent, targetUrl) {
  try {
    await sendLogToContent('🔍 开始分析邮箱创建表单...', 'info', { 
      targetUrl: targetUrl,
      subStep: '表单分析'
    });
    
    // 精确的字段识别 - 基于用户提供的具体输入框信息
    const emailInputMatch = pageContent.match(/<input[^>]*name="email"[^>]*>/i);
    const passwordInputMatch = pageContent.match(/<input[^>]*name="password"[^>]*>/i);
    const confirmPasswordInputMatch = pageContent.match(/<input[^>]*name="password2"[^>]*>/i);
    const unameInputMatch = pageContent.match(/<input[^>]*name="uname"[^>]*>/i);
    
    // 查找表单标签和提交按钮
    const formMatch = pageContent.match(/<form[^>]*>/i);
    const submitButtonMatch = pageContent.match(/<button[^>]*type="submit"[^>]*>/i) || 
                             pageContent.match(/<input[^>]*type="submit"[^>]*>/i) ||
                             pageContent.match(/<input[^>]*id="mysubmit"[^>]*>/i);
    
    // 查找CSRF Token
    const csrfTokenMatch = pageContent.match(/<input[^>]*name="(csrf_token|token|_token|csrf)"[^>]*value="([^"]*)"[^>]*>/i);
    const csrfToken = csrfTokenMatch ? csrfTokenMatch[2] : null;
    
    // 查找表单action和method
    const formActionMatch = formMatch ? formMatch[0].match(/action="([^"]*)"/i) : null;
    const formMethodMatch = formMatch ? formMatch[0].match(/method="([^"]*)"/i) : null;
    
    const formAnalysis = {
      hasEmailInput: !!emailInputMatch,
      hasPasswordInput: !!passwordInputMatch,
      hasConfirmPasswordInput: !!confirmPasswordInputMatch,
      hasUnameInput: !!unameInputMatch,
      hasForm: !!formMatch,
      hasSubmitButton: !!submitButtonMatch,
      hasCsrfToken: !!csrfToken,
      emailInputDetails: emailInputMatch ? emailInputMatch[0] : null,
      passwordInputDetails: passwordInputMatch ? passwordInputMatch[0] : null,
      confirmPasswordInputDetails: confirmPasswordInputMatch ? confirmPasswordInputMatch[0] : null,
      unameInputDetails: unameInputMatch ? unameInputMatch[0] : null,
      formDetails: formMatch ? formMatch[0] : null,
      submitButtonDetails: submitButtonMatch ? submitButtonMatch[0] : null,
      csrfToken: csrfToken,
      formAction: formActionMatch ? formActionMatch[1] : null,
      formMethod: formMethodMatch ? formMethodMatch[1] : 'POST'
    };
    
    // 分析表单提交机制
    const submissionAnalysis = analyzeFormSubmission(pageContent);
    
    await sendLogToContent('📋 增强表单分析结果:', 'info', { 
      formAnalysis: formAnalysis,
      submissionAnalysis: submissionAnalysis,
      subStep: '表单分析完成'
    });
    
    return {
      ...formAnalysis,
      submission: submissionAnalysis
    };
    
  } catch (error) {
    await sendLogToContent(`❌ 表单分析失败: ${error.message}`, 'error', { 
      error: error.message,
      targetUrl: targetUrl,
      subStep: '表单分析失败'
    });
    return null;
  }
}

// 邮箱创建诊断函数
async function diagnoseEmailCreationRequest(targetUrl, createData) {
  try {
    await sendLogToContent('🔍 开始邮箱创建诊断...', 'info', { 
      targetUrl: targetUrl,
      subStep: '诊断开始'
    });
    
    // 步骤1: 检查目标URL的可访问性
    await sendLogToContent('📋 步骤1: 检查URL可访问性...', 'info', { subStep: 'URL检查' });
    
    const urlCheckResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${EMAIL_CONFIG.adminUrl}/Index/login`
      }
    });
    
    await sendLogToContent(`📊 URL检查结果: ${targetUrl} - 状态: ${urlCheckResponse.status}`, 'info', { 
      url: targetUrl,
      status: urlCheckResponse.status,
      statusText: urlCheckResponse.statusText,
      subStep: 'URL检查结果'
    });
    
    if (!urlCheckResponse.ok) {
      return {
        success: false,
        error: `URL不可访问: ${urlCheckResponse.status}`,
        url: targetUrl,
        status: urlCheckResponse.status
      };
    }
    
    // 步骤2: 分析页面内容
    await sendLogToContent('📄 步骤2: 分析页面内容...', 'info', { subStep: '内容分析' });
    
    const pageContent = await urlCheckResponse.text();
    const contentLength = pageContent.length;
    
    await sendLogToContent(`📏 页面内容长度: ${contentLength} 字符`, 'info', { 
      contentLength: contentLength,
      subStep: '内容长度'
    });
    
    // 分析页面结构
    const pageAnalysis = {
      hasForm: pageContent.includes('<form'),
      hasInput: pageContent.includes('<input'),
      hasButton: pageContent.includes('<button'),
      hasEmail: pageContent.includes('email') || pageContent.includes('邮箱'),
      hasPassword: pageContent.includes('password') || pageContent.includes('密码'),
      hasUser: pageContent.includes('user') || pageContent.includes('User') || pageContent.includes('用户'),
      hasCreate: pageContent.includes('create') || pageContent.includes('创建'),
      hasAdd: pageContent.includes('add') || pageContent.includes('添加'),
      hasSubmit: pageContent.includes('submit') || pageContent.includes('提交'),
      hasAdmin: pageContent.includes('admin') || pageContent.includes('管理'),
      hasCenter: pageContent.includes('center') || pageContent.includes('Center'),
      hasIndex: pageContent.includes('index') || pageContent.includes('Index')
    };
    
    await sendLogToContent('🔍 页面结构分析结果:', 'info', { 
      analysis: pageAnalysis,
      subStep: '结构分析'
    });
    
    // 步骤3: 尝试POST请求测试
    await sendLogToContent('📤 步骤3: 测试POST请求...', 'info', { subStep: 'POST测试' });
    
    const testPostResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${EMAIL_CONFIG.adminUrl}/Index/login`
      },
      body: createData.toString()
    });
    
    await sendLogToContent(`📊 POST测试结果: ${targetUrl} - 状态: ${testPostResponse.status}`, 'info', { 
      url: targetUrl,
      status: testPostResponse.status,
      statusText: testPostResponse.statusText,
      subStep: 'POST测试结果'
    });
    
    // 步骤4: 分析响应内容
    let responseContent = '';
    try {
      responseContent = await testPostResponse.text();
      await sendLogToContent(`📄 响应内容长度: ${responseContent.length} 字符`, 'info', { 
        responseLength: responseContent.length,
        subStep: '响应分析'
      });
      
      // 检查响应中是否包含成功或错误信息
      const responseAnalysis = {
        hasSuccess: responseContent.includes('success') || responseContent.includes('成功') || responseContent.includes('Success'),
        hasError: responseContent.includes('error') || responseContent.includes('错误') || responseContent.includes('Error'),
        hasRedirect: responseContent.includes('redirect') || responseContent.includes('重定向') || responseContent.includes('Redirect'),
        hasForm: responseContent.includes('<form'),
        hasInput: responseContent.includes('<input'),
        isJson: responseContent.trim().startsWith('{') || responseContent.trim().startsWith('[')
      };
      
      await sendLogToContent('🔍 响应内容分析:', 'info', { 
        responseAnalysis: responseAnalysis,
        subStep: '响应分析'
      });
      
    } catch (contentError) {
      await sendLogToContent(`⚠️ 响应内容读取失败: ${contentError.message}`, 'warning', { 
        error: contentError.message,
        subStep: '响应读取失败'
      });
    }
    
    // 步骤5: 检查其他可能的创建端点
    await sendLogToContent('🔗 步骤4: 检查其他可能的创建端点...', 'info', { subStep: '端点检查' });
    
    const alternativeEndpoints = [
      '/Users/create',
      '/users/create', 
      '/User/create',
      '/user/create',
      '/Users/add',
      '/users/add',
      '/User/add',
      '/user/add',
      '/api/users/create',
      '/api/Users/create',
      '/admin/Users/create',
      '/admin/users/create',
      '/Center/Users/create',
      '/Center/users/create'
    ];
    
    const endpointResults = [];
    
    for (const endpoint of alternativeEndpoints) {
      try {
        const endpointUrl = `${EMAIL_CONFIG.adminUrl}${endpoint}`;
        const endpointResponse = await fetch(endpointUrl, {
          method: 'GET',
          headers: {
            ...BROWSER_HEADERS,
            'Referer': `${EMAIL_CONFIG.adminUrl}/Index/login`
          }
        });
        
        endpointResults.push({
          endpoint: endpoint,
          url: endpointUrl,
          status: endpointResponse.status,
          accessible: endpointResponse.ok
        });
        
      } catch (endpointError) {
        endpointResults.push({
          endpoint: endpoint,
          url: `${EMAIL_CONFIG.adminUrl}${endpoint}`,
          status: 'ERROR',
          accessible: false,
          error: endpointError.message
        });
      }
    }
    
    await sendLogToContent('🔗 端点检查结果:', 'info', { 
      endpointResults: endpointResults,
      subStep: '端点检查结果'
    });
    
    // 返回诊断结果
    const diagnosisResult = {
      success: true,
      targetUrl: targetUrl,
      urlAccessible: urlCheckResponse.ok,
      urlStatus: urlCheckResponse.status,
      pageAnalysis: pageAnalysis,
      postTestStatus: testPostResponse.status,
      responseLength: responseContent.length,
      alternativeEndpoints: endpointResults,
      recommendations: []
    };
    
    // 生成建议
    if (!pageAnalysis.hasForm) {
      diagnosisResult.recommendations.push('页面不包含表单，可能不是创建页面');
    }
    
    if (!pageAnalysis.hasEmail && !pageAnalysis.hasUser) {
      diagnosisResult.recommendations.push('页面不包含邮箱或用户相关字段');
    }
    
    if (testPostResponse.status === 404) {
      diagnosisResult.recommendations.push('POST请求返回404，端点可能不存在');
    }
    
    if (testPostResponse.status === 403) {
      diagnosisResult.recommendations.push('POST请求被拒绝，可能需要不同的权限或CSRF token');
    }
    
    // 检查可访问的端点
    const accessibleEndpoints = endpointResults.filter(ep => ep.accessible);
    if (accessibleEndpoints.length > 0) {
      diagnosisResult.recommendations.push(`发现 ${accessibleEndpoints.length} 个可访问的端点，建议尝试这些端点`);
    }
    
    await sendLogToContent('📋 诊断完成，生成建议:', 'info', { 
      recommendations: diagnosisResult.recommendations,
      subStep: '诊断完成'
    });
    
    return diagnosisResult;
    
  } catch (error) {
    await sendLogToContent(`❌ 邮箱创建诊断失败: ${error.message}`, 'error', { 
      error: error.message,
      targetUrl: targetUrl,
      subStep: '诊断失败'
    });
    
    return {
      success: false,
      error: error.message,
      targetUrl: targetUrl
    };
  }
}

// 邮箱创建诊断函数
async function diagnoseEmailCreationRequest(targetUrl, createData) {
  try {
    await sendLogToContent('🔍 开始邮箱创建诊断...', 'info', { 
      targetUrl: targetUrl,
      subStep: '诊断开始'
    });
    
    // 步骤1: 检查目标URL的可访问性
    await sendLogToContent('📋 步骤1: 检查URL可访问性...', 'info', { subStep: 'URL检查' });
    
    const urlCheckResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${EMAIL_CONFIG.adminUrl}/Index/login`
      }
    });
    
    await sendLogToContent(`📊 URL检查结果: ${targetUrl} - 状态: ${urlCheckResponse.status}`, 'info', { 
      url: targetUrl,
      status: urlCheckResponse.status,
      statusText: urlCheckResponse.statusText,
      subStep: 'URL检查结果'
    });
    
    if (!urlCheckResponse.ok) {
      return {
        success: false,
        error: `URL不可访问: ${urlCheckResponse.status}`,
        url: targetUrl,
        status: urlCheckResponse.status
      };
    }
    
    // 步骤2: 分析页面内容
    await sendLogToContent('📄 步骤2: 分析页面内容...', 'info', { subStep: '内容分析' });
    
    const pageContent = await urlCheckResponse.text();
    const contentLength = pageContent.length;
    
    await sendLogToContent(`📏 页面内容长度: ${contentLength} 字符`, 'info', { 
      contentLength: contentLength,
      subStep: '内容长度'
    });
    
    // 分析页面结构
    const pageAnalysis = {
      hasForm: pageContent.includes('<form'),
      hasInput: pageContent.includes('<input'),
      hasButton: pageContent.includes('<button'),
      hasEmail: pageContent.includes('email') || pageContent.includes('邮箱'),
      hasPassword: pageContent.includes('password') || pageContent.includes('密码'),
      hasUser: pageContent.includes('user') || pageContent.includes('User') || pageContent.includes('用户'),
      hasCreate: pageContent.includes('create') || pageContent.includes('创建'),
      hasAdd: pageContent.includes('add') || pageContent.includes('添加'),
      hasSubmit: pageContent.includes('submit') || pageContent.includes('提交'),
      hasAdmin: pageContent.includes('admin') || pageContent.includes('管理'),
      hasCenter: pageContent.includes('center') || pageContent.includes('Center'),
      hasIndex: pageContent.includes('index') || pageContent.includes('Index')
    };
    
    await sendLogToContent('🔍 页面结构分析结果:', 'info', { 
      analysis: pageAnalysis,
      subStep: '结构分析'
    });
    
    // 步骤3: 尝试POST请求测试
    await sendLogToContent('📤 步骤3: 测试POST请求...', 'info', { subStep: 'POST测试' });
    
    const testPostResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${EMAIL_CONFIG.adminUrl}/Index/login`
      },
      body: createData.toString()
    });
    
    await sendLogToContent(`📊 POST测试结果: ${targetUrl} - 状态: ${testPostResponse.status}`, 'info', { 
      url: targetUrl,
      status: testPostResponse.status,
      statusText: testPostResponse.statusText,
      subStep: 'POST测试结果'
    });
    
    // 步骤4: 分析响应内容
    let responseContent = '';
    try {
      responseContent = await testPostResponse.text();
      await sendLogToContent(`📄 响应内容长度: ${responseContent.length} 字符`, 'info', { 
        responseLength: responseContent.length,
        subStep: '响应分析'
      });
      
      // 检查响应中是否包含成功或错误信息
      const responseAnalysis = {
        hasSuccess: responseContent.includes('success') || responseContent.includes('成功') || responseContent.includes('Success'),
        hasError: responseContent.includes('error') || responseContent.includes('错误') || responseContent.includes('Error'),
        hasRedirect: responseContent.includes('redirect') || responseContent.includes('重定向') || responseContent.includes('Redirect'),
        hasForm: responseContent.includes('<form'),
        hasInput: responseContent.includes('<input'),
        isJson: responseContent.trim().startsWith('{') || responseContent.trim().startsWith('[')
      };
      
      await sendLogToContent('🔍 响应内容分析:', 'info', { 
        responseAnalysis: responseAnalysis,
        subStep: '响应分析'
      });
      
    } catch (contentError) {
      await sendLogToContent(`⚠️ 响应内容读取失败: ${contentError.message}`, 'warning', { 
        error: contentError.message,
        subStep: '响应读取失败'
      });
    }
    
    // 步骤5: 检查其他可能的创建端点
    await sendLogToContent('🔗 步骤4: 检查其他可能的创建端点...', 'info', { subStep: '端点检查' });
    
    const alternativeEndpoints = [
      '/Users/create',
      '/users/create', 
      '/User/create',
      '/user/create',
      '/Users/add',
      '/users/add',
      '/User/add',
      '/user/add',
      '/api/users/create',
      '/api/Users/create',
      '/admin/Users/create',
      '/admin/users/create',
      '/Center/Users/create',
      '/Center/users/create'
    ];
    
    const endpointResults = [];
    
    for (const endpoint of alternativeEndpoints) {
      try {
        const endpointUrl = `${EMAIL_CONFIG.adminUrl}${endpoint}`;
        const endpointResponse = await fetch(endpointUrl, {
          method: 'GET',
          headers: {
            ...BROWSER_HEADERS,
            'Referer': `${EMAIL_CONFIG.adminUrl}/Index/login`
          }
        });
        
        endpointResults.push({
          endpoint: endpoint,
          url: endpointUrl,
          status: endpointResponse.status,
          accessible: endpointResponse.ok
        });
        
      } catch (endpointError) {
        endpointResults.push({
          endpoint: endpoint,
          url: `${EMAIL_CONFIG.adminUrl}${endpoint}`,
          status: 'ERROR',
          accessible: false,
          error: endpointError.message
        });
      }
    }
    
    await sendLogToContent('🔗 端点检查结果:', 'info', { 
      endpointResults: endpointResults,
      subStep: '端点检查结果'
    });
    
    // 返回诊断结果
    const diagnosisResult = {
      success: true,
      targetUrl: targetUrl,
      urlAccessible: urlCheckResponse.ok,
      urlStatus: urlCheckResponse.status,
      pageAnalysis: pageAnalysis,
      postTestStatus: testPostResponse.status,
      responseLength: responseContent.length,
      alternativeEndpoints: endpointResults,
      recommendations: []
    };
    
    // 生成建议
    if (!pageAnalysis.hasForm) {
      diagnosisResult.recommendations.push('页面不包含表单，可能不是创建页面');
    }
    
    if (!pageAnalysis.hasEmail && !pageAnalysis.hasUser) {
      diagnosisResult.recommendations.push('页面不包含邮箱或用户相关字段');
    }
    
    if (testPostResponse.status === 404) {
      diagnosisResult.recommendations.push('POST请求返回404，端点可能不存在');
    }
    
    if (testPostResponse.status === 403) {
      diagnosisResult.recommendations.push('POST请求被拒绝，可能需要不同的权限或CSRF token');
    }
    
    // 检查可访问的端点
    const accessibleEndpoints = endpointResults.filter(ep => ep.accessible);
    if (accessibleEndpoints.length > 0) {
      diagnosisResult.recommendations.push(`发现 ${accessibleEndpoints.length} 个可访问的端点，建议尝试这些端点`);
    }
    
    await sendLogToContent('📋 诊断完成，生成建议:', 'info', { 
      recommendations: diagnosisResult.recommendations,
      subStep: '诊断完成'
    });
    
    return diagnosisResult;
    
  } catch (error) {
    await sendLogToContent(`❌ 邮箱创建诊断失败: ${error.message}`, 'error', { 
      error: error.message,
      targetUrl: targetUrl,
      subStep: '诊断失败'
    });
    
    return {
      success: false,
      error: error.message,
      targetUrl: targetUrl
    };
  }
}
