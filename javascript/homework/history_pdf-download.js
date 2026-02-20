// 只使用Blob方式的PDF下载
function downloadPDF(url, filename) {
    // 显示加载提示（可选）
    console.log('开始下载:', filename);
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应不正常: ' + response.status);
            }
            return response.blob();
        })
        .then(blob => {
            // 创建blob URL并下载
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // 清理资源
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
            
            console.log('下载完成:', filename);
        })
        .catch(error => {
            console.error('下载失败:', error);
            // 如果Blob方式失败，使用原始链接（但文件名可能不对）
            alert('下载失败，将尝试直接下载文件。文件名可能为f.txt，请手动重命名。');
            window.open(url, '_blank');
        });
}

// 页面加载后绑定事件
document.addEventListener('DOMContentLoaded', function() {
    const pdfLinks = document.querySelectorAll('a.download-link.pdf');
    pdfLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const url = this.getAttribute('href');
            const filename = this.getAttribute('download');
            downloadPDF(url, filename);
        });
    });
});