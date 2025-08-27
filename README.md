# 图标文件说明

## 当前状态
- `icon.svg` - SVG格式的扩展图标（128x128像素）

## Chrome扩展要求
Chrome扩展需要以下尺寸的PNG格式图标：
- `icon16.png` - 16x16像素
- `icon48.png` - 48x48像素  
- `icon128.png` - 128x128像素

## 生成PNG图标的方法

### 方法1：在线转换工具
1. 访问在线SVG转PNG工具（如：https://convertio.co/svg-png/）
2. 上传 `icon.svg` 文件
3. 分别设置输出尺寸为16x16、48x48、128x128
4. 下载转换后的PNG文件
5. 重命名为对应的文件名

### 方法2：使用图像编辑软件
1. 使用Photoshop、GIMP、Inkscape等软件
2. 打开 `icon.svg` 文件
3. 分别导出为不同尺寸的PNG文件
4. 确保文件名正确

### 方法3：使用命令行工具（需要安装ImageMagick）
```bash
# 安装ImageMagick后，在icons目录执行：
magick convert icon.svg -resize 16x16 icon16.png
magick convert icon.svg -resize 48x48 icon48.png
magick convert icon.svg -resize 128x128 icon128.png
```

## 图标设计说明
当前图标设计包含：
- 渐变背景（蓝紫色调）
- AI大脑图案（代表人工智能）
- 邮箱符号（代表邮件功能）
- 现代化设计风格

## 注意事项
- 确保生成的PNG文件质量清晰
- 图标应该在不同尺寸下都清晰可辨
- 文件名必须完全匹配（区分大小写）
- 图标文件大小建议控制在合理范围内

## 临时解决方案
如果暂时无法生成PNG图标，可以：
1. 使用任何16x16、48x48、128x128的PNG图片
2. 重命名为对应的文件名
3. 扩展仍然可以正常工作，只是显示默认图标

