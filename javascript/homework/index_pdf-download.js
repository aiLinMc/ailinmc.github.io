function downloadPDF(url, filename) {
    console.log('开始下载:', filename);
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应不正常: ' + response.status);
            }
            return response.blob();
        })
        .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
            
            console.log('下载完成:', filename);
        })
        .catch(error => {
            console.error('下载失败:', error);
            alert('下载失败，将尝试直接下载文件。文件名可能为f.txt，请手动重命名。');
            window.open(url, '_blank');
        });
}

// 页面加载后绑定事件
document.addEventListener('DOMContentLoaded', function() {
    const pdfLinks = document.querySelectorAll('a.download-pdf');
    pdfLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const url = this.getAttribute('href');
            const filename = this.getAttribute('data-filename');
            downloadPDF(url, filename);
        });
    });
});