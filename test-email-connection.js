// 邮箱管理后台连接测试脚本 - 修复版本
// 确保只有真正登录成功才继续执行

// 测试配置
const TEST_CONFIG = {
  adminUrl: 'http://mail.turtur.us:8010',
  loginUrl: 'http://mail.turtur.us:8010/Center/Index/login',
  adminCredentials: { username: 'ceshi', password: 'ceshi123' }
};

// 浏览器请求头配置
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

// 严格的登录状态验证函数
async function verifyLoginStatus() {
  console.log('🔐 开始严格验证登录状态...');
  
  try {
    // 方法1: 检查登录页面是否仍然存在
    console.log('📋 方法1: 检查是否仍在登录页面...');
    const loginPageResponse = await fetch(`${TEST_CONFIG.adminUrl}/Center/Index/login`, {
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    
    if (loginPageResponse.ok) {
      const loginPageText = await loginPageResponse.text();
      if (loginPageText.includes('登录') || loginPageText.includes('username') || loginPageText.includes('password')) {
        console.log('❌ 仍在登录页面，登录失败');
        return false;
      }
    }
    
    // 方法2: 尝试访问需要登录的页面
    console.log('📋 方法2: 尝试访问受保护页面...');
    const protectedPageResponse = await fetch(`${TEST_CONFIG.adminUrl}/Users`, {
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    
    if (!protectedPageResponse.ok) {
      console.log(`❌ 无法访问受保护页面，状态码: ${protectedPageResponse.status}`);
      return false;
    }
    
    const protectedPageText = await protectedPageResponse.text();
    
    // 检查是否被重定向到登录页
    if (protectedPageText.includes('登录') || protectedPageText.includes('username') || protectedPageText.includes('password')) {
      console.log('❌ 被重定向到登录页，登录失败');
      return false;
    }
    
    // 检查是否包含管理功能内容
    if (!protectedPageText.includes('用户管理') && !protectedPageText.includes('邮箱管理') && !protectedPageText.includes('管理')) {
      console.log('❌ 页面内容不符合预期，登录失败');
      return false;
    }
    
    console.log('✅ 登录状态验证成功');
    return true;
    
  } catch (error) {
    console.log(`❌ 登录状态验证错误: ${error.message}`);
    return false;
  }
}

// 测试登录流程
async function testLoginFlow() {
  console.log('🚀 开始测试登录流程...');
  
  try {
    // 步骤1: 发送登录请求
    console.log('📤 步骤1: 发送登录请求...');
    const loginData = new URLSearchParams();
    loginData.append('username', TEST_CONFIG.adminCredentials.username);
    loginData.append('password', TEST_CONFIG.adminCredentials.password);
    
    const loginResponse = await fetch(TEST_CONFIG.loginUrl, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': TEST_CONFIG.loginUrl
      },
      body: loginData
    });
    
    console.log(`📊 登录响应状态: ${loginResponse.status} ${loginResponse.statusText}`);
    
    // 步骤2: 严格验证登录状态
    console.log('🔍 步骤2: 严格验证登录状态...');
    const isLoggedIn = await verifyLoginStatus();
    
    if (!isLoggedIn) {
      throw new Error('登录失败：登录状态验证失败');
    }
    
    console.log('✅ 登录成功！可以继续执行后续步骤');
    return true;
    
  } catch (error) {
    console.log(`💥 登录流程失败: ${error.message}`);
    return false;
  }
}

// 运行测试
async function runTest() {
  console.log('🧪 开始运行登录测试...');
  console.log('='.repeat(50));
  
  const result = await testLoginFlow();
  
  console.log('='.repeat(50));
  if (result) {
    console.log('🎉 测试通过：登录成功');
  } else {
    console.log('❌ 测试失败：登录失败');
  }
  
  return result;
}

// 导出测试函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTest, verifyLoginStatus };
} else {
  // 在浏览器环境中运行
  window.testLoginFlow = runTest;
  console.log('💡 在浏览器控制台中运行: testLoginFlow()');
}

