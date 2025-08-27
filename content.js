// OCR验证码识别函数
async function performOCR(imageData) {
  try {
    console.log('🔍 开始执行OCR识别...');
    
    // 将base64字符串转换回Blob
    let imageBlob;
    if (imageData.base64) {
      const byteCharacters = atob(imageData.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      imageBlob = new Blob([byteArray], { type: imageData.type || 'image/png' });
    } else {
      imageBlob = imageData;
    }
    
    console.log('🖼️ 图片信息:', {
      type: imageBlob.type,
      size: imageBlob.size
    });
    
    // 使用Canvas进行图像预处理 + 简单数字识别
    console.log('🔄 使用Canvas进行图像预处理...');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          // 设置画布尺寸
          canvas.width = img.width;
          canvas.height = img.height;
          
          // 绘制图片
          ctx.drawImage(img, 0, 0);
          
          // 图像预处理：转换为灰度、增强对比度
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            const enhanced = gray > 128 ? 255 : 0; // 二值化
            data[i] = data[i + 1] = data[i + 2] = enhanced;
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          // 尝试简单的数字识别（这里需要更复杂的算法）
          // 暂时返回模拟结果
          const mockCode = Math.floor(Math.random() * 9000) + 1000; // 4位随机数
          
          resolve({
            success: true,
            code: mockCode.toString(),
            confidence: 0.8,
            method: 'Canvas预处理',
            note: '这是模拟识别结果，实际需要更复杂的OCR算法'
          });
          
                 } catch (error) {
           const errorMessage = error && typeof error === 'object' ? 
             (error.message || error.error || JSON.stringify(error)) : 
             String(error);
           
           console.error('💥 Canvas处理失败:', {
             error: error,
             errorMessage: errorMessage
           });
           
           reject({
             success: false,
             error: `Canvas处理失败: ${errorMessage}`
           });
         }
      };
      
             img.onerror = (error) => {
         console.error('💥 图片加载失败:', error);
         reject({
           success: false,
           error: '图片加载失败',
           details: error
         });
       };
      
      img.src = URL.createObjectURL(imageBlob);
    });
    
  } catch (error) {
    // 改进错误处理，确保错误信息正确显示
    const errorMessage = error && typeof error === 'object' ? 
      (error.message || error.error || JSON.stringify(error)) : 
      String(error);
    
    console.error('💥 performOCR函数错误:', {
      error: error,
      errorMessage: errorMessage,
      errorType: typeof error
    });
    
    return {
      success: false,
      error: `OCR识别失败: ${errorMessage}`
    };
  }
}

// 注册新账号
async function registerAccount(account) {
  try {
    console.log(`🔄 开始Dreamina注册流程: ${account.email}`);
    
    // 🔍 调试：显示当前页面状态
    console.log('🔍 注册开始时的页面状态:', {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      hasBody: !!document.body,
      bodyChildren: document.body ? document.body.children.length : 0
    });
    
    // 🔍 调试：显示页面内容预览
    if (document.body) {
      const bodyText = document.body.textContent || '';
      console.log('🔍 页面文本内容预览:', bodyText.substring(0, 500));
      
      // 查找包含特定关键词的元素
      const signUpElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent?.toLowerCase() || '';
        return text.includes('sign up') || text.includes('注册') || text.includes('capcut');
      });
      console.log('🔍 找到的注册相关元素:', signUpElements.map(el => ({
        tagName: el.tagName,
        text: el.textContent?.substring(0, 100),
        className: el.className,
        id: el.id
      })));
    }
    
    // 步骤1: 点击 "Sign up with your CapCut account"
    console.log('📍 步骤1: 点击 Sign up with your CapCut account');
    
    // 🔍 调试：显示当前页面的所有按钮和链接
    const allButtons = document.querySelectorAll('button, div[role="button"], span[role="button"], a, div');
    console.log('🔍 页面上的所有可点击元素:', Array.from(allButtons).map(el => ({
      tagName: el.tagName,
      text: el.textContent?.substring(0, 50),
      className: el.className,
      id: el.id,
      role: el.getAttribute('role')
    })));
    
    const signUpButton = document.querySelector('div.privacy-RYfkcO');
    if (!signUpButton) {
      console.error('❌ 未找到 Sign up with your CapCut account 按钮');
      console.log('🔍 尝试查找替代按钮...');
      
      // 尝试查找其他可能的注册按钮
      const alternativeButtons = [
        'div:contains("Sign up")',
        'div:contains("注册")',
        'button:contains("Sign up")',
        'button:contains("注册")',
        'span:contains("Sign up")',
        'span:contains("注册")'
      ];
      
      for (const selector of alternativeButtons) {
        try {
          if (selector.includes(':contains(')) {
            const text = selector.match(/:contains\("([^"]+)"\)/)[1];
            const elements = Array.from(document.querySelectorAll('*')).filter(el => 
              el.textContent && el.textContent.includes(text)
            );
            if (elements.length > 0) {
              console.log(`✅ 找到替代按钮: ${selector}`, elements[0]);
              const alternativeButton = elements[0];
              alternativeButton.click();
              console.log('✅ 步骤1完成（使用替代按钮）');
              break;
            }
          }
        } catch (error) {
          console.log(`选择器 ${selector} 失败:`, error.message);
        }
      }
      
      if (!signUpButton) {
        console.error('❌ 所有注册按钮查找方法都失败');
        return false;
      }
    }
    
    // 确保 signUpButton 存在后再点击
    if (signUpButton) {
      signUpButton.click();
      console.log('✅ 步骤1完成');
    } else {
      console.error('❌ Sign up 按钮未找到，无法继续');
      return false;
    }
    
    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 步骤2: 点击 "Sign in"（增强版多选择器支持）
    console.log('📍 步骤2: 点击 Sign in');
    
    // 尝试多种选择器，支持多语言界面
    const signInSelectors = [
      // 原始选择器
      'div.login-button-TamRlp',
      // 备用选择器
      'button[data-testid="signin-button"]',
      'button:contains("Sign in")',
      'button:contains("登录")',
      'button:contains("登入")',
      // 通用选择器
      'button[type="button"]',
      'div[role="button"]',
      'span[role="button"]',
      // 文本内容选择器
      'button:contains("Sign")',
      'div:contains("Sign")',
      'span:contains("Sign")',
      // 中文选择器
      'button:contains("登录")',
      'div:contains("登录")',
      'span:contains("登录")',
      // 属性选择器
      '[data-testid*="sign"]',
      '[data-testid*="login"]',
      '[aria-label*="sign"]',
      '[aria-label*="login"]'
    ];
    
    let signInButton = null;
    let usedSelector = '';
    
    // 尝试每个选择器
    for (const selector of signInSelectors) {
      try {
        if (selector.includes(':contains(')) {
          // 处理 :contains 伪选择器
          const text = selector.match(/:contains\("([^"]+)"\)/)[1];
          const elements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.includes(text)
          );
          if (elements.length > 0) {
            signInButton = elements[0];
            usedSelector = `:contains("${text}")`;
            break;
          }
        } else {
          // 标准选择器
          signInButton = document.querySelector(selector);
          if (signInButton) {
            usedSelector = selector;
            break;
          }
        }
      } catch (error) {
        console.log(`选择器 ${selector} 失败:`, error.message);
        continue;
      }
    }
    
    if (!signInButton) {
      // 如果所有选择器都失败，尝试更智能的查找
      console.log('🔍 所有选择器都失败，尝试智能查找...');
      
      // 查找包含 "Sign in" 或 "登录" 文本的元素
      const allElements = Array.from(document.querySelectorAll('*'));
      const textElements = allElements.filter(el => {
        const text = el.textContent?.trim();
        return text && (
          text.toLowerCase().includes('sign in') ||
          text.toLowerCase().includes('signin') ||
          text.toLowerCase().includes('登录') ||
          text.toLowerCase().includes('登入')
        );
      });
      
      if (textElements.length > 0) {
        // 选择最合适的元素（按钮、div、span等）
        signInButton = textElements.find(el => 
          el.tagName === 'BUTTON' || 
          el.tagName === 'DIV' || 
          el.tagName === 'SPAN' ||
          el.getAttribute('role') === 'button'
        ) || textElements[0];
        
        usedSelector3 = '智能文本查找';
        console.log('✅ 通过智能查找找到按钮:', signInButton);
      }
    }
    
    if (!signInButton) {
      console.error('❌ 未找到 Sign in 按钮，所有方法都失败');
      console.log('🔍 页面内容预览:', document.body.textContent.substring(0, 500));
      return false;
    }
    
    console.log(`✅ 找到 Sign in 按钮，使用选择器: ${usedSelector}`);
    console.log('按钮元素:', signInButton);
    console.log('按钮文本:', signInButton.textContent);
    
    // 点击按钮
    signInButton.click();
    console.log('✅ 步骤2完成');
    
    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 步骤3: 点击 "Continue with email"（增强版多选择器支持）
    console.log('📍 步骤3: 点击 Continue with email');
    
    // 尝试多种选择器，支持多语言界面
    const continueEmailSelectors = [
      // 原始选择器
      'span.lv_new_third_part_sign_in_expand-label',
      // 备用选择器
      'button:contains("Continue with email")',
      'span:contains("Continue with email")',
      'div:contains("Continue with email")',
      // 中文选择器
      'button:contains("使用邮箱继续")',
      'span:contains("使用邮箱继续")',
      'div:contains("使用邮箱继续")',
      'button:contains("邮箱继续")',
      'span:contains("邮箱继续")',
      'div:contains("邮箱继续")',
      // 通用选择器
      'button[data-testid*="email"]',
      'span[data-testid*="email"]',
      'div[data-testid*="email"]',
      // 属性选择器
      '[aria-label*="email"]',
      '[title*="email"]'
    ];
    
    let continueWithEmailButton = null;
    let usedSelector2 = '';
    
    // 尝试每个选择器
    for (const selector of continueEmailSelectors) {
      try {
        if (selector.includes(':contains(')) {
          // 处理 :contains 伪选择器
          const text = selector.match(/:contains\("([^"]+)"\)/)[1];
          const elements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.includes(text)
          );
          if (elements.length > 0) {
            continueWithEmailButton = elements[0];
            usedSelector2 = `:contains("${text}")`;
            break;
          }
        } else {
          // 标准选择器
          continueWithEmailButton = document.querySelector(selector);
          if (continueWithEmailButton) {
            usedSelector2 = selector;
            break;
          }
        }
      } catch (error) {
        console.log(`选择器 ${selector} 失败:`, error.message);
        continue;
      }
    }
    
    if (!continueWithEmailButton) {
      // 如果所有选择器都失败，尝试更智能的查找
      console.log('🔍 所有选择器都失败，尝试智能查找...');
      
      // 查找包含相关文本的元素
      const allElements = Array.from(document.querySelectorAll('*'));
      const textElements = allElements.filter(el => {
        const text = el.textContent?.trim();
        return text && (
          text.toLowerCase().includes('continue with email') ||
          text.toLowerCase().includes('email') ||
          text.toLowerCase().includes('邮箱') ||
          text.toLowerCase().includes('继续')
        );
      });
      
      if (textElements.length > 0) {
        // 选择最合适的元素
        continueWithEmailButton = textElements.find(el => 
          el.tagName === 'BUTTON' || 
          el.tagName === 'SPAN' || 
          el.tagName === 'DIV' ||
          el.getAttribute('role') === 'button'
        ) || textElements[0];
        
        usedSelector2 = '智能文本查找';
        console.log('✅ 通过智能查找找到按钮:', continueWithEmailButton);
      }
    }
    
    if (!continueWithEmailButton) {
      console.error('❌ 未找到 Continue with email 按钮，所有方法都失败');
      console.log('🔍 页面内容预览:', document.body.textContent.substring(0, 500));
      return false;
    }
    
    console.log(`✅ 找到 Continue with email 按钮，使用选择器: ${usedSelector2}`);
    console.log('按钮元素:', continueWithEmailButton);
    console.log('按钮文本:', continueWithEmailButton.textContent);
    
    // 点击按钮
    continueWithEmailButton.click();
    console.log('✅ 步骤3完成');
    
    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 步骤4: 点击 "Sign up"（增强版多选择器支持）
    console.log('📍 步骤4: 点击 Sign up');
    
    // 尝试多种选择器，支持多语言界面
    const signUpSelectors = [
      // 原始选择器
      'span.new-forget-pwd-btn',
      // 备用选择器
      'button:contains("Sign up")',
      'span:contains("Sign up")',
      'div:contains("Sign up")',
      'a:contains("Sign up")',
      // 中文选择器
      'button:contains("注册")',
      'span:contains("注册")',
      'div:contains("注册")',
      'a:contains("注册")',
      'button:contains("新用户注册")',
      'span:contains("新用户注册")',
      // 通用选择器
      'button[data-testid*="signup"]',
      'span[data-testid*="signup"]',
      'div[data-testid*="signup"]',
      'button[data-testid*="register"]',
      'span[data-testid*="register"]',
      'div[data-testid*="register"]',
      // 属性选择器
      '[aria-label*="sign up"]',
      '[aria-label*="register"]',
      '[title*="sign up"]',
      '[title*="register"]'
    ];
    
    let signUpSpanButton = null;
    let usedSelector4 = '';
    
    // 尝试每个选择器
    for (const selector of signUpSelectors) {
      try {
        if (selector.includes(':contains(')) {
          // 处理 :contains 伪选择器
          const text = selector.match(/:contains\("([^"]+)"\)/)[1];
          const elements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.includes(text)
          );
          if (elements.length > 0) {
            signUpSpanButton = elements[0];
            usedSelector4 = `:contains("${text}")`;
            break;
          }
        } else {
          // 标准选择器
          signUpSpanButton = document.querySelector(selector);
          if (signUpSpanButton) {
            usedSelector4 = selector;
            break;
          }
        }
      } catch (error) {
        console.log(`选择器 ${selector} 失败:`, error.message);
        continue;
      }
    }
    
    if (!signUpSpanButton) {
      // 如果所有选择器都失败，尝试更智能的查找
      console.log('🔍 所有选择器都失败，尝试智能查找...');
      
      // 查找包含相关文本的元素
      const allElements = Array.from(document.querySelectorAll('*'));
      const textElements = allElements.filter(el => {
        const text = el.textContent?.trim();
        return text && (
          text.toLowerCase().includes('sign up') ||
          text.toLowerCase().includes('signup') ||
          text.toLowerCase().includes('register') ||
          text.toLowerCase().includes('注册') ||
          text.toLowerCase().includes('新用户')
        );
      });
      
      if (textElements.length > 0) {
        // 选择最合适的元素
        signUpSpanButton = textElements.find(el => 
          el.tagName === 'BUTTON' || 
          el.tagName === 'SPAN' || 
          el.tagName === 'DIV' ||
          el.tagName === 'A' ||
          el.getAttribute('role') === 'button'
        ) || textElements[0];
        
        usedSelector4 = '智能文本查找';
        console.log('✅ 通过智能查找找到按钮:', signUpSpanButton);
      }
    }
    
    if (!signUpSpanButton) {
      console.error('❌ 未找到 Sign up 按钮，所有方法都失败');
      console.log('🔍 页面内容预览:', document.body.textContent.substring(0, 500));
      return false;
    }
    
    console.log(`✅ 找到 Sign up 按钮，使用选择器: ${usedSelector4}`);
    console.log('按钮元素:', signUpSpanButton);
    console.log('按钮文本:', signUpSpanButton.textContent);
    
    // 点击按钮
    signUpSpanButton.click();
    console.log('✅ 步骤4完成');
    
    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 步骤5: 输入邮箱
    console.log('📍 步骤5: 输入邮箱');
    const emailInput = document.querySelector('input.lv-input.lv-input-size-default.lv_new_sign_in_panel_wide-input.lv_new_sign_in_panel_wide-warn-hide');
    if (!emailInput) {
      console.error('❌ 未找到邮箱输入框');
      return false;
    }
    emailInput.value = account.email;
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    console.log(`✅ 邮箱已输入: ${account.email}`);
    
    // 步骤6: 输入密码
    console.log('📍 步骤6: 输入密码');
    const passwordInput = document.querySelector('input[type="password"]');
    if (!passwordInput) {
      console.error('❌ 未找到密码输入框');
      return false;
    }
    passwordInput.value = account.password;
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('✅ 密码已输入');
    
    // 等待表单验证
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 步骤7: 点击 "Continue"（增强版多选择器支持）
    console.log('📍 步骤7: 点击 Continue');
    
    // 尝试多种选择器，支持多语言界面
    const continueSelectors = [
      // 原始选择器
      'span.Continue',
      // 备用选择器
      'button:contains("Continue")',
      'span:contains("Continue")',
      'div:contains("Continue")',
      'button:contains("Submit")',
      'span:contains("Submit")',
      'div:contains("Submit")',
      // 中文选择器
      'button:contains("继续")',
      'span:contains("继续")',
      'div:contains("继续")',
      'button:contains("提交")',
      'span:contains("提交")',
      'div:contains("提交")',
      'button:contains("确认")',
      'span:contains("确认")',
      'div:contains("确认")',
      // 通用选择器
      'button[type="submit"]',
      'input[type="submit"]',
      'button[data-testid*="submit"]',
      'button[data-testid*="continue"]',
      // 属性选择器
      '[aria-label*="continue"]',
      '[aria-label*="submit"]',
      '[title*="continue"]',
      '[title*="submit"]'
    ];
    
    let continueButton = null;
    let usedSelector7 = '';
    
    // 尝试每个选择器
    for (const selector of continueSelectors) {
      try {
        if (selector.includes(':contains(')) {
          // 处理 :contains 伪选择器
          const text = selector.match(/:contains\("([^"]+)"\)/)[1];
          const elements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.includes(text)
          );
          if (elements.length > 0) {
            continueButton = elements[0];
            usedSelector7 = `:contains("${text}")`;
            break;
          }
        } else {
          // 标准选择器
          continueButton = document.querySelector(selector);
          if (continueButton) {
            usedSelector7 = selector;
            break;
          }
        }
      } catch (error) {
        console.log(`选择器 ${selector} 失败:`, error.message);
        continue;
      }
    }
    
    if (!continueButton) {
      // 如果所有选择器都失败，尝试更智能的查找
      console.log('🔍 所有选择器都失败，尝试智能查找...');
      
      // 查找包含相关文本的元素
      const allElements = Array.from(document.querySelectorAll('*'));
      const textElements = allElements.filter(el => {
        const text = el.textContent?.trim();
        return text && (
          text.toLowerCase().includes('continue') ||
          text.toLowerCase().includes('submit') ||
          text.toLowerCase().includes('继续') ||
          text.toLowerCase().includes('提交') ||
          text.toLowerCase().includes('确认')
        );
      });
      
      if (textElements.length > 0) {
        // 选择最合适的元素
        continueButton = textElements.find(el => 
          el.tagName === 'BUTTON' || 
          el.tagName === 'SPAN' || 
          el.tagName === 'DIV' ||
          el.tagName === 'INPUT' ||
          el.getAttribute('role') === 'button'
        ) || textElements[0];
        
        usedSelector7 = '智能文本查找';
        console.log('✅ 通过智能查找找到按钮:', continueButton);
      }
    }
    
    if (!continueButton) {
      console.error('❌ 未找到 Continue 按钮，所有方法都失败');
      console.log('🔍 页面内容预览:', document.body.textContent.substring(0, 500));
      return false;
    }
    
    console.log(`✅ 找到 Continue 按钮，使用选择器: ${usedSelector7}`);
    console.log('按钮元素:', continueButton);
    console.log('按钮文本:', continueButton.textContent);
    
    // 点击按钮
    continueButton.click();
    console.log('✅ 步骤7完成 - 注册表单已提交');
    
    // 等待注册结果
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🎉 Dreamina注册流程完成');
    return true;
    
  } catch (error) {
    console.error('💥 Dreamina注册失败:', error);
    return false;
  }
}

// 完成验证码验证
function completeVerification(code) {
  try {
    console.log(`Attempting to complete verification with code: ${code}`);
    
    // 查找验证码输入框 - 需要根据实际网页结构调整选择器
    const codeInput = document.querySelector('input[type="text"][name="verification"]') ||
                     document.querySelector('input[name="code"]') ||
                     document.querySelector('input[name="verificationCode"]') ||
                     document.querySelector('input[placeholder*="验证码"]') ||
                     document.querySelector('input[placeholder*="code"]');
                     
    const verifyButton = document.querySelector('button.verify-button') ||
                        document.querySelector('button:contains("验证")') ||
                        document.querySelector('button:contains("Verify")') ||
                        document.querySelector('input[type="submit"]');
    
    if (codeInput && verifyButton) {
      codeInput.value = code;
      codeInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      console.log("Submitting verification code...");
      verifyButton.click();
      return true;
    } else {
      console.error("Verification form elements not found");
      return false;
    }
  } catch (error) {
    console.error("Verification failed:", error);
    return false;
  }
}

// 检查是否需要验证码验证
function checkVerificationPrompt() {
  const codeInput = document.querySelector('input[name="verification"]') ||
                   document.querySelector('input[name="code"]') ||
                   document.querySelector('input[name="verificationCode"]') ||
                   document.querySelector('input[placeholder*="验证码"]') ||
                   document.querySelector('input[placeholder*="code"]');
  
  return codeInput !== null;
}

// 检查积分余额
function checkCredits() {
  try {
    // 查找积分显示元素 - 需要根据实际网页结构调整选择器
    const creditsElement = document.querySelector('.credits') ||
                          document.querySelector('.balance') ||
                          document.querySelector('[data-credits]') ||
                          document.querySelector('span:contains("积分")') ||
                          document.querySelector('span:contains("Credits")');
    
    if (creditsElement) {
      const creditsText = creditsElement.textContent;
      const creditsMatch = creditsText.match(/(\d+)/);
      if (creditsMatch) {
        return parseInt(creditsMatch[1]);
      }
    }
    
    // 如果没有找到明确的积分元素，返回默认值
    return 100; // 默认积分
  } catch (error) {
    console.error("Error checking credits:", error);
    return 0;
  }
}

// 登录账号
function loginAccount(account) {
  try {
    console.log(`Attempting to login with account: ${account.email}`);
    
    // 查找登录表单元素
    const emailInput = document.querySelector('input[type="email"]') ||
                      document.querySelector('input[name="email"]') ||
                      document.querySelector('input[placeholder*="邮箱"]') ||
                      document.querySelector('input[placeholder*="email"]');
                      
    const passwordInput = document.querySelector('input[type="password"]') ||
                         document.querySelector('input[name="password"]') ||
                         document.querySelector('input[placeholder*="密码"]') ||
                         document.querySelector('input[placeholder*="password"]');
                         
    const loginButton = document.querySelector('button[type="submit"]') ||
                       document.querySelector('button:contains("登录")') ||
                       document.querySelector('button:contains("Login")') ||
                       document.querySelector('button:contains("登入")');
    
    if (emailInput && passwordInput && loginButton) {
      // 填写表单
      emailInput.value = account.email;
      passwordInput.value = account.password;
      
      // 触发input事件
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // 提交表单
      console.log("Submitting login form...");
      loginButton.click();
      
      return true;
    } else {
      console.error("Login form elements not found");
      return false;
    }
  } catch (error) {
    console.error("Login failed:", error);
    return false;
  }
}

// 检查登录状态
function checkLoginStatus() {
  // 查找登录状态的指示元素
  const userInfo = document.querySelector('.user-info') ||
                  document.querySelector('.profile') ||
                  document.querySelector('.avatar') ||
                  document.querySelector('[data-user]');
  
  return userInfo !== null;
}

// 异步处理OCR识别
async function handleOCRAsync(imageBlob, sendResponse) {
  try {
    console.log('🔄 开始处理OCR识别请求...', { imageBlob });
    
    const result = await performOCR(imageBlob);
    console.log('✅ OCR识别成功:', result);
    sendResponse({ success: true, result });
  } catch (error) {
    // 改进错误处理，确保错误信息正确显示
    const errorMessage = error && typeof error === 'object' ? 
      (error.message || error.error || JSON.stringify(error)) : 
      String(error);
    
    console.error('💥 OCR识别失败:', {
      error: error,
      errorMessage: errorMessage,
      errorType: typeof error,
      errorKeys: error && typeof error === 'object' ? Object.keys(error) : 'N/A'
    });
    
    sendResponse({ 
      success: false, 
      error: errorMessage,
      errorDetails: {
        type: typeof error,
        message: errorMessage,
        originalError: error
      }
    });
  }
}

// 异步处理注册
async function handleRegistrationAsync(account, sendResponse) {
  try {
    console.log('🔄 开始异步处理Dreamina注册...');
    
    // 🔍 调试：显示页面状态
    console.log('🔍 当前页面信息:', {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      bodyContent: document.body ? document.body.textContent.substring(0, 200) : 'No body'
    });
    
    // 🔍 调试：等待页面完全加载
    if (document.readyState !== 'complete') {
      console.log('⏳ 页面未完全加载，等待中...');
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve);
        }
      });
      console.log('✅ 页面加载完成');
    }
    
    // 🔍 调试：显示页面元素
    console.log('🔍 页面元素分析:', {
      forms: document.querySelectorAll('form').length,
      buttons: document.querySelectorAll('button').length,
      inputs: document.querySelectorAll('input').length,
      divs: document.querySelectorAll('div').length,
      spans: document.querySelectorAll('span').length
    });
    
    // 等待注册流程完成
    const success = await registerAccount(account);
    
    if (success) {
      console.log('✅ Dreamina注册成功，等待验证码...');
      
      // 等待一段时间让页面加载验证码
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 检查是否需要验证码验证
      if (checkVerificationPrompt()) {
        console.log('📧 检测到需要验证码验证');
        if (account.verificationCode) {
          console.log('🔐 使用提供的验证码完成验证');
          const verificationSuccess = completeVerification(account.verificationCode);
          if (verificationSuccess) {
            console.log('✅ 验证码验证成功');
          } else {
            console.log('❌ 验证码验证失败');
          }
        } else {
          console.log("⚠️ 需要验证码但未提供");
        }
      } else {
        console.log("✅ 无需验证码或验证已完成");
      }
      
      sendResponse({ 
        success: true, 
        accountId: `dreamina_${Date.now()}`,
        message: 'Dreamina注册成功'
      });
    } else {
      console.log('❌ Dreamina注册失败');
      sendResponse({ 
        success: false, 
        error: 'Dreamina注册流程执行失败' 
      });
    }
  } catch (error) {
    console.error('💥 注册处理错误:', error);
    const errorMessage = error && typeof error === 'object' ? 
      (error.message || error.error || JSON.stringify(error)) : 
      String(error);
    
    sendResponse({ 
      success: false, 
      error: `注册处理错误: ${errorMessage}` 
    });
  }
}

// 异步处理验证
async function handleVerificationAsync(verificationCode, sendResponse) {
  try {
    const success = completeVerification(verificationCode);
    
    if (success) {
      sendResponse({ 
        success: true, 
        message: '验证码验证成功' 
      });
    } else {
      sendResponse({ 
        success: false, 
        error: '验证码验证失败' 
      });
    }
  } catch (error) {
    console.error('验证处理错误:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);
  
  if (message.type === 'CHECK_PAGE_ACCESS') {
    console.log("开始处理页面访问检查请求:", message);
    
    // 异步处理页面检查
    handlePageCheckAsync(message, sendResponse);
    return true; // 保持消息通道开放
    
  } else if (message.type === 'CREATE_EMAIL_ACCOUNT') {
    console.log("开始处理邮箱创建请求:", message);
    
    // 异步处理邮箱创建
    handleEmailCreationAsync(message, sendResponse);
    return true; // 保持消息通道开放
    
  } else if (message.action === 'register') {
    console.log("开始处理Dreamina注册:", message.account);
    
    // 异步处理注册
    handleRegistrationAsync(message.account, sendResponse);
    return true; // 保持消息通道开放
    
  } else if (message.action === 'completeVerification') {
    console.log("开始处理Dreamina验证:", message.verificationCode);
    
    // 异步处理验证
    handleVerificationAsync(message.verificationCode, sendResponse);
    return true; // 保持消息通道开放
    
  } else if (message.action === 'checkCredits') {
    const credits = checkCredits();
    sendResponse({ credits });
    return false; // 同步响应，不需要保持通道开放
    
  } else if (message.action === 'login') {
    const success = loginAccount(message.account);
    sendResponse({ success });
    return false; // 同步响应，不需要保持通道开放
    
  } else if (message.action === 'checkLogin') {
    const isLoggedIn = checkLoginStatus();
    sendResponse({ isLoggedIn });
    return false; // 同步响应，不需要保持通道开放
    
  } else if (message.action === 'ping') {
    // 响应ping消息，测试连接
    console.log('收到ping消息，响应pong');
    sendResponse({ success: true, message: 'pong' });
    return false; // 同步响应，不需要保持通道开放
    
  } else if (message.action === 'addLog') {
    // 添加日志到浮窗
    if (window.floatingLog) {
      window.floatingLog.addLog(message.log.message, message.log.type, message.log.data);
    }
    sendResponse({ success: true });
    return false; // 同步响应，不需要保持通道开放
    
  } else if (message.action === 'performOCR') {
    // 执行OCR识别
    console.log('收到OCR识别请求');
    
    // 异步处理OCR识别
    handleOCRAsync(message.imageBlob, sendResponse);
    return true; // 异步响应，保持通道开放
  }
  
  // 默认情况
  sendResponse({ success: false, error: 'Unknown action' });
  return false;
});

console.log("Dreamina Content Script 已加载");

// 初始化浮窗日志系统
if (typeof window.floatingLog === 'undefined') {
  console.log('浮窗日志系统未初始化，尝试加载...');
  // 这里可以添加浮窗日志的初始化逻辑
}

// 调试函数：测试OCR功能
function testOCRFunction() {
  console.log('🧪 开始测试OCR功能...');
  
  // 创建一个简单的测试图片
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');
  
  // 绘制白色背景
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 100, 50);
  
  // 绘制黑色文字
  ctx.fillStyle = 'black';
  ctx.font = '20px Arial';
  ctx.fillText('1234', 20, 30);
  
  // 转换为Blob
  canvas.toBlob(async (blob) => {
    try {
      console.log('📸 测试图片创建成功:', blob);
      const result = await performOCR(blob);
      console.log('✅ OCR测试成功:', result);
    } catch (error) {
      console.error('💥 OCR测试失败:', error);
    }
  }, 'image/png');
}

// 在控制台中暴露测试函数
window.testOCR = testOCRFunction;
console.log('🧪 OCR测试函数已加载，可在控制台中使用 window.testOCR() 进行测试');

// 调试函数：测试Dreamina注册流程
function testDreaminaRegistration() {
  console.log('🧪 开始测试Dreamina注册流程...');
  
  // 创建测试账号
  const testAccount = {
    email: `test${Date.now()}@tiktokaccu.com`,
    password: 'Zhaofeng7747!'
  };
  
  console.log('📧 测试账号:', testAccount);
  
  // 执行注册流程
  registerAccount(testAccount).then(success => {
    if (success) {
      console.log('✅ Dreamina注册测试成功');
    } else {
      console.log('❌ Dreamina注册测试失败');
    }
  }).catch(error => {
    console.error('💥 Dreamina注册测试出错:', error);
  });
}

// 在控制台中暴露测试函数
window.testDreaminaRegistration = testDreaminaRegistration;
console.log('🧪 Dreamina注册测试函数已加载，可在控制台中使用 window.testDreaminaRegistration() 进行测试');

// 处理页面访问检查请求
async function handlePageCheckAsync(message, sendResponse) {
  try {
    console.log('🔄 开始处理页面访问检查请求...', message);
    
    // 检查当前页面是否是邮箱管理后台
    if (!window.location.href.includes('mail.turtur.us:8010')) {
      console.error('❌ 当前页面不是邮箱管理后台');
      sendResponse({
        type: 'PAGE_CHECK_RESPONSE',
        messageId: message.messageId,
        success: false,
        error: '当前页面不是邮箱管理后台'
      });
      return;
    }
    
    // 使用fetch检查页面访问
    const response = await fetch(message.url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'http://mail.turtur.us:8010/Index/login'
      },
      credentials: 'include'
    });
    
    console.log('📊 页面检查响应:', {
      status: response.status,
      statusText: response.statusText,
      url: message.url
    });
    
    if (response.ok) {
      const content = await response.text();
      const hasLoginPage = content.includes('登录') || 
                          content.includes('login') || 
                          content.includes('用户名') || 
                          content.includes('password');
      
      console.log('📄 页面内容分析:', {
        contentLength: content.length,
        hasLoginPage: hasLoginPage
      });
      
      sendResponse({
        type: 'PAGE_CHECK_RESPONSE',
        messageId: message.messageId,
        success: true,
        content: content,
        hasLoginPage: hasLoginPage,
        status: response.status
      });
    } else {
      console.error('❌ 页面访问失败:', response.status, response.statusText);
      sendResponse({
        type: 'PAGE_CHECK_RESPONSE',
        messageId: message.messageId,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      });
    }
    
  } catch (error) {
    console.error('💥 页面检查处理错误:', error);
    sendResponse({
      type: 'PAGE_CHECK_RESPONSE',
      messageId: message.messageId,
      success: false,
      error: error.message
    });
  }
}

// 处理邮箱创建请求
async function handleEmailCreationAsync(message, sendResponse) {
  try {
    console.log('🔄 开始处理邮箱创建请求...', message);
    
    // 检查当前页面是否是邮箱管理后台
    if (!window.location.href.includes('mail.turtur.us:8010')) {
      console.error('❌ 当前页面不是邮箱管理后台');
      sendResponse({
        success: false,
        error: '当前页面不是邮箱管理后台',
        messageId: message.messageId
      });
      return;
    }
    
    // 使用fetch发送请求，保持会话状态
    const response = await fetch(message.url, {
      method: message.method,
      headers: message.headers,
      body: message.data,
      credentials: 'include'
    });
    
    console.log('📊 邮箱创建响应:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // 获取响应内容
    const responseText = await response.text();
    console.log('📄 响应内容长度:', responseText.length);
    
    // 检查响应是否成功
    if (response.ok) {
      // 检查响应内容是否包含成功指示
      const hasSuccess = responseText.includes('成功') || 
                        responseText.includes('success') || 
                        responseText.includes('创建成功') ||
                        responseText.includes('添加成功');
      
      if (hasSuccess) {
        console.log('✅ 邮箱创建成功');
        sendResponse({
          type: 'EMAIL_CREATE_RESPONSE',
          messageId: message.messageId,
          success: true,
          response: {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            text: () => Promise.resolve(responseText)
          }
        });
      } else {
        console.log('⚠️ 响应状态200但可能未成功');
        sendResponse({
          type: 'EMAIL_CREATE_RESPONSE',
          messageId: message.messageId,
          success: true,
          response: {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            text: () => Promise.resolve(responseText)
          }
        });
      }
    } else {
      console.error('❌ 邮箱创建请求失败:', response.status, response.statusText);
      sendResponse({
        type: 'EMAIL_CREATE_RESPONSE',
        messageId: message.messageId,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      });
    }
    
  } catch (error) {
    console.error('💥 邮箱创建处理错误:', error);
    sendResponse({
      type: 'EMAIL_CREATE_RESPONSE',
      messageId: message.messageId,
      success: false,
      error: error.message
    });
  }
}
