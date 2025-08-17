function buildSimpleJpegPdf(jpegU8, imgW, imgH) {
  const enc = (s) => {
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
    return arr;
  };
  const concat = (arrays) => {
    let total = 0;
    arrays.forEach(a => total += a.length);
    const out = new Uint8Array(total);
    let offset = 0;
    arrays.forEach(a => { out.set(a, offset); offset += a.length; });
    return out;
  };
  const pad10 = (n) => n.toString().padStart(10, '0');

  const pageW = 595;
  const pageH = 842;
  const contentStr = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = enc(contentStr);

  const header = concat([enc('%PDF-1.4\n'), enc('%\xFF\xFF\xFF\xFF\n')]);
  const objects = [];
  const offsets = [0];
  let cursor = header.length;

  const obj1 = enc('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offsets.push(cursor); cursor += obj1.length; objects.push(obj1);

  const obj2 = enc('2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n');
  offsets.push(cursor); cursor += obj2.length; objects.push(obj2);

  const pageDict = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n';
  const obj3 = enc(pageDict);
  offsets.push(cursor); cursor += obj3.length; objects.push(obj3);

  const imgHeader = '4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegU8.length + ' >>\nstream\n';
  const imgFooter = enc('\nendstream\nendobj\n');
  const obj4_head = enc(imgHeader);
  offsets.push(cursor);
  cursor += obj4_head.length + jpegU8.length + imgFooter.length;
  objects.push(obj4_head, jpegU8, imgFooter);

  const contHeader = '5 0 obj\n<< /Length ' + contentBytes.length + ' >>\nstream\n';
  const contFooter = enc('\nendstream\nendobj\n');
  const obj5_head = enc(contHeader);
  offsets.push(cursor);
  cursor += obj5_head.length + contentBytes.length + contFooter.length;
  objects.push(obj5_head, contentBytes, contFooter);

  const body = concat(objects);
  const startXref = header.length + body.length;
  let xrefStr = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    xrefStr += pad10(offsets[i]) + ' 00000 n \n';
  }
  const xref = enc(xrefStr);
  const trailer = 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + startXref + '\n%%EOF';
  const trailerBytes = enc(trailer);

  return concat([header, body, xref, trailerBytes]);
}

Page({
  data: {
    a4Image: ''
  },

  onLoad: function (options) {
    const { front, back } = options;
    if (front && back) {
      this.composeA4(front, back);
    }
  },

  composeA4: function (frontImage, backImage) {
    const query = wx.createSelectorQuery();
    query.select('#a4canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        const dpr = wx.getSystemInfoSync().pixelRatio;
        const a4w = 794;
        const a4h = 1123;
        canvas.width = a4w * dpr;
        canvas.height = a4h * dpr;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, a4w, a4h);

        const idCardW = 323; // 85.6mm at 96dpi
        const idCardH = 204; // 54mm at 96dpi

        const drawIDCard = (imagePath, x, y, width, height) => {
          return new Promise((resolve) => {
            const img = canvas.createImage();
            img.onload = () => {
              ctx.drawImage(img, x, y, width, height);
              resolve();
            };
            img.src = imagePath;
          });
        };

        const gap = 120;
        const x = (a4w - idCardW) / 2;
        const totalBlockHeight = idCardH * 2 + gap;
        const y1 = (a4h - totalBlockHeight) / 2;
        const y2 = y1 + idCardH + gap;

        Promise.all([
          drawIDCard(frontImage, x, y1, idCardW, idCardH),
          drawIDCard(backImage, x, y2, idCardW, idCardH)
        ]).then(() => {
          wx.canvasToTempFilePath({
            canvas,
            fileType: 'jpg', // Ensure the output is a JPEG
            success: (res) => {
              this.setData({
                a4Image: res.tempFilePath
              });
            },
            fail: (err) => {
              console.error(err);
            }
          });
        });
      });
  },

  saveImage: function () {
    if (this.data.a4Image) {
      wx.saveImageToPhotosAlbum({
        filePath: this.data.a4Image,
        success: () => {
          wx.showToast({
            title: '保存成功'
          });
        },
        fail: (err) => {
          if (err.errMsg.includes('auth')) {
            wx.showModal({
              title: '授权失败',
              content: '请授权保存图片到相册',
              success: (res) => {
                if(res.confirm) {
                  wx.openSetting();
                }
              }
            })
          }
        }
      });
    }
  },

  exportPdf: function() {
    if (!this.data.a4Image) return;
    
    wx.showLoading({ title: '正在生成PDF...' });
    
    const fs = wx.getFileSystemManager();
    const imgPath = this.data.a4Image;
    
    wx.getImageInfo({
      src: imgPath,
      success: (imgInfo) => {
        fs.readFile({
          filePath: imgPath,
          success: (res) => {
            try {
              const jpegU8 = new Uint8Array(res.data);
              const pdfU8 = buildSimpleJpegPdf(jpegU8, imgInfo.width, imgInfo.height);
              const buf = pdfU8.buffer.slice(pdfU8.byteOffset, pdfU8.byteOffset + pdfU8.byteLength);
              const outPath = `${wx.env.USER_DATA_PATH}/idcopy_${Date.now()}.pdf`;

              fs.writeFile({
                filePath: outPath,
                data: buf,
                success: () => {
                  wx.hideLoading();
                  wx.openDocument({
                    filePath: outPath,
                    fileType: 'pdf',
                    showMenu: true,
                  });
                },
                fail: () => {
                  wx.hideLoading();
                  wx.showToast({ 
                    title: 'PDF导出失败', 
                    icon: 'none' 
                  });
                }
              });
            } catch (e) {
              wx.hideLoading();
              wx.showToast({ 
                title: 'PDF生成错误', 
                icon: 'none' 
              });
            }
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ 
              title: '读取图片失败', 
              icon: 'none' 
            });
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ 
          title: '获取图片信息失败', 
          icon: 'none' 
        });
      }
    });
  }
});