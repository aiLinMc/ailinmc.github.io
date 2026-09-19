// 检测URL参数并隐藏APP链接
document.addEventListener('DOMContentLoaded', function() {
    // 检查URL参数
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('source') === 'app') {
        // 如果在APP内运行，隐藏下载链接
        document.getElementById('app-link').classList.add('hidden');
    }
});