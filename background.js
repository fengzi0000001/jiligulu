const ADMIN_URL = "http://mail.turtur.us:8010";
const WEBMAIL_URL = "http://mail.turtur.us:8000";
const ADMIN_CREDS = { username: "ceshi", password: "ceshi123" };
const DEFAULT_PASSWORD = "ceshi123";
const DOMAIN = "tiktokaccu.com";

let currentAccount = null;
let isMonitoring = false;

// 登录邮箱管理后台
async function adminLogin() {
  try {
    const response = await fetch(`${ADMIN_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${ADMIN_CREDS.username}&password=${ADMIN_CREDS.password}`
    });
    return response.headers.get("set-cookie");
  } catch (error) {
    console.error("Admin login failed:", error);
    return null;
  }
}

// 创建新邮箱账号
async function createEmailAccount(cookie) {
  try {
    const randomString = Math.random().toString(36).substring(2, 6);
    const email = `jimeng_${randomString}@${DOMAIN}`;
    
    const response = await fetch(`${ADMIN_URL}/Users/edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie
      },
      body: `email=${email}&password=${DEFAULT_PASSWORD}`
    });
    
    if (response.ok) {
      console.log(`Created email account: ${email}`);
      return email;
    } else {
      throw new Error(`Failed to create email: ${response.status}`);
    }
  } catch (error) {
    console.error("Email creation failed:", error);
    return null;
  }
}

// 从webmail获取验证码
async function getVerificationCode(email) {
  try {
    // 这里需要根据实际webmail系统调整
    // 伪代码示例：
    const response = await fetch(`${WEBMAIL_URL}/inbox`, {
      headers: { 
        "Authorization": `Basic ${btoa(`${email}:${DEFAULT_PASSWORD}`)}` 
      }
    });
    
    if (response.ok) {
      const emails = await response.json();
      const verificationEmail = emails.find(e => e.subject.includes("Dreamina验证码") || e.subject.includes("验证码"));
      if (verificationEmail) {
        const codeMatch = verificationEmail.body.match(/\d{6}/);
        return codeMatch ? codeMatch[0] : null;
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to get verification code:", error);
    return null;
  }
}

// 主要账号创建流程
async function createNewAccount() {
  try {
    console.log("Starting account creation process...");
    
    // 1. 登录管理后台
    const cookie = await adminLogin();
    if (!cookie) {
      throw new Error("Failed to login to admin panel");
    }
    
    // 2. 创建新邮箱账号
    const newEmail = await createEmailAccount(cookie);
    if (!newEmail) {
      throw new Error("Failed to create email account");
    }
    
    // 3. 等待验证码邮件并获取
    console.log("Waiting for verification email...");
    await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒
    
    const verificationCode = await getVerificationCode(newEmail);
    if (!verificationCode) {
      console.log("Verification code not found, continuing without it...");
    }
    
    // 4. 设置当前账号
    currentAccount = { 
      email: newEmail, 
      password: DEFAULT_PASSWORD,
      verificationCode: verificationCode
    };
    
    await chrome.storage.local.set({ currentAccount });
    console.log(`Account created: ${newEmail}`);
    
    // 5. 通知内容脚本进行注册
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'register',
        account: currentAccount
      });
    }
    
    return true;
  } catch (error) {
    console.error("Account creation failed:", error);
    return false;
  }
}

// 开始监控积分
function startCreditMonitoring() {
  if (isMonitoring) return;
  
  isMonitoring = true;
  console.log("Starting credit monitoring...");
  
  const monitorInterval = setInterval(async () => {
    if (!isMonitoring) {
      clearInterval(monitorInterval);
      return;
    }
    
    const [tab] = await chrome.tabs.query({ url: '*://*.dreamina.capcut.com/*' });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'checkCredits' });
    }
  }, 30000); // 每30秒检查一次
}

// 停止监控
function stopCreditMonitoring() {
  isMonitoring = false;
  console.log("Credit monitoring stopped");
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'creditsExhausted') {
    console.log("Credits exhausted, creating new account...");
    createNewAccount();
  } else if (message.action === 'startMonitoring') {
    startCreditMonitoring();
    createNewAccount(); // 立即创建第一个账号
  } else if (message.action === 'stopMonitoring') {
    stopCreditMonitoring();
  }
});

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log("Dreamina自动注册扩展已安装");
  chrome.storage.local.set({ 
    currentAccount: null,
    isMonitoring: false
  });
});

// 启动时加载状态
chrome.runtime.onStartup.addListener(async () => {
  const { currentAccount: savedAccount, isMonitoring: savedMonitoring } = 
    await chrome.storage.local.get(['currentAccount', 'isMonitoring']);
  
  if (savedAccount) {
    currentAccount = savedAccount;
  }
  
  if (savedMonitoring) {
    startCreditMonitoring();
  }
});
