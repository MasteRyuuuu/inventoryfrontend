
// 初始化 LayUI 表单
layui.use(['form', 'layer'], function () {
    const form = layui.form;
    const layer = layui.layer;

    form.on('submit(submit)', function (data) {
        const field = data.field;
        const barcodeInput = document.getElementById('barcodeInput');

        const payload = {
            materialId: parseInt(barcodeInput.dataset.materialId || 0),
            operation: field.operation,
            quantity: parseFloat(field.quantity),
            barcode: field.barcode,
            source: "scan",
            operator: "admin"
        };

        const url = payload.operation === 'in'
            ? 'https://inventorybackend-n8p4.onrender.com/api/Transactions/in'
            : 'https://inventorybackend-n8p4.onrender.com/api/Transactions/out';

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (!res.ok) throw new Error("Submit failed");
                return res.json();
            })
            .then(result => {
                layer.msg("Submit success");
                console.log("后端返回：", result);
            })
            .catch(err => {
                console.error(err);
                layer.alert("ubmit failed");
            });

        return false;
    });
});

// ZXing 逻辑
window.addEventListener('load', function () {
    let selectedDeviceId;
    const codeReader = new ZXing.BrowserMultiFormatReader();
    const video = document.getElementById('camera');
    const barcodeInput = document.getElementById('barcodeInput'); // 表单中的条码输入框
    let lastScanned = '';
    let debounce = false;

    codeReader.listVideoInputDevices()
        .then((videoInputDevices) => {
            selectedDeviceId = videoInputDevices[0].deviceId;

            // 启动扫码
            codeReader.decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
                if (result && !debounce && result.text !== lastScanned) {
                    const code = result.text;
                    lastScanned = code;
                    debounce = true;
                    barcodeInput.value = code;

                    // 查询后端是否存在条码
                    fetch(`https://inventorybackend-n8p4.onrender.com/api/barcodes/${code}`)
                        .then(res => {
                            if (!res.ok) throw new Error("Not Found");
                            return res.json();
                        })
                        .then(data => {
                            barcodeInput.value = code;
                            barcodeInput.dataset.materialId = data.materialId; 
                            document.getElementById("productName").value = data.materialName; // ✅ 设置商品名
                            layui.layer.msg(`Barcode recognized：${data.materialName}`, { icon: 1 });
                        })
                        .catch(() => {
                            layui.layer.open({
                                type: 1,
                                title: `No code found ${code}，please type in`,
                                area: ['420px', '420px'],
                                content: `
    <form class="layui-form" style="padding: 20px;" id="newMaterialForm">
      <div class="layui-form-item">
        <label class="layui-form-label">Name</label>
        <div class="layui-input-block">
          <input type="text" name="name" required lay-verify="required" placeholder="Name" class="layui-input">
        </div>
      </div>
      <div class="layui-form-item">
        <label class="layui-form-label">Unit</label>
        <div class="layui-input-block">
          <input type="text" name="unit" required lay-verify="required" placeholder="Bag" class="layui-input">
        </div>
      </div>
      <div class="layui-form-item">
        <label class="layui-form-label">Quantity</label>
        <div class="layui-input-block">
          <input type="number" name="perPackageQty" required lay-verify="required" value="1" class="layui-input">
        </div>
      </div>
      <div class="layui-form-item">
        <label class="layui-form-label">Threshold</label>
        <div class="layui-input-block">
          <input type="number" name="threshold" value="0" class="layui-input">
        </div>
      </div>
      <div class="layui-form-item">
        <div class="layui-input-block">
          <button class="layui-btn" lay-submit lay-filter="submitMaterial">submit</button>
        </div>
      </div>
    </form>
  `,
                                success: function () {
                                    layui.form.render();
                                    layui.form.on('submit(submitMaterial)', function (formData) {
                                        const materialPayload = {
                                            id: 0,
                                            name: formData.field.name,
                                            unit: formData.field.unit,
                                            perPackageQty: parseInt(formData.field.perPackageQty),
                                            threshold: parseInt(formData.field.threshold)
                                        };

                                        // 先添加 material
                                        fetch('https://inventorybackend-n8p4.onrender.com/api/materials', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(materialPayload)
                                        })
                                            .then(res => res.json())
                                            .then(material => {
                                                const barcodePayload = {
                                                    id: 0,
                                                    materialId: material.id,
                                                    code: barcodeInput.value,
                                                    note: ''
                                                };

                                                // 再添加 barcode
                                                return fetch('https://inventorybackend-n8p4.onrender.com/api/barcodes', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify(barcodePayload)
                                                }).then(() => material);
                                                
                                            })
                                            .then(material => {
                                                barcodeInput.dataset.materialId = material.id;
                                                document.getElementById("productName").value = material.name;
                                                layui.layer.msg("Recorded", { icon: 1 });
                                                layui.layer.closeAll();
                                            })
                                            .catch(err => {
                                                const message = typeof err === 'string' ? err : (err?.message || 'Unknown error');
                                                layui.layer.alert(message, { icon: 2 });
                                            });

                                        return false;
                                    });
                                }
                            });

                        })

                        .finally(() => {
                            // 允许下一次扫码
                            setTimeout(() => {
                                debounce = false;
                            }, 1000); // 1秒避免重复识别同一条码
                        });
                }

                if (err && !(err instanceof ZXing.NotFoundException)) {
                    console.error('Error:', err);
                }
            });

            console.log(`Using camera：${selectedDeviceId}`);
        })
        .catch((err) => {
            console.error('Camera failed:', err);
            alert('Camera failed');
        });
});

function setQuantity(value) {
    document.getElementById('quantityInput').value = value;
}

