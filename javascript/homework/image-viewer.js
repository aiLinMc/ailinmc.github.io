/* 页面内图片查看器：点击图片链接不再跳转/下载，而是在当前页弹层显示 */
(function () {
    'use strict';

    var IMG_EXT = /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i;
    var viewer = null;
    var imgEl = null;
    var scrollEl = null;
    var closeBtn = null;
    var lastFocus = null;

    function build() {
        viewer = document.createElement('div');
        viewer.className = 'img-viewer';
        viewer.setAttribute('role', 'dialog');
        viewer.setAttribute('aria-modal', 'true');
        viewer.setAttribute('aria-label', '作业图片');
        viewer.innerHTML =
            '<div class="img-viewer-panel">' +
                '<div class="img-viewer-scroll">' +
                    '<img class="img-viewer-img" alt="作业图片">' +
                '</div>' +
                '<div class="img-viewer-bar">' +
                    '<span class="img-viewer-hint">长按图片保存</span>' +
                    '<button class="img-viewer-close" type="button" aria-label="关闭">✕</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(viewer);

        imgEl = viewer.querySelector('.img-viewer-img');
        scrollEl = viewer.querySelector('.img-viewer-scroll');
        closeBtn = viewer.querySelector('.img-viewer-close');

        closeBtn.addEventListener('click', close);
        viewer.addEventListener('click', function (e) {
            if (e.target === viewer || e.target === scrollEl) close();
        });
        document.addEventListener('keydown', function (e) {
            if ((e.key === 'Escape' || e.key === 'Esc') && isOpen()) close();
        });
    }

    function isOpen() {
        return viewer !== null && viewer.classList.contains('is-open');
    }

    function open(src, alt) {
        if (!viewer) build();
        lastFocus = document.activeElement;
        imgEl.setAttribute('src', src);
        imgEl.setAttribute('alt', alt || '作业图片');
        scrollEl.scrollTop = 0;
        viewer.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        if (closeBtn && closeBtn.focus) closeBtn.focus();
    }

    function close() {
        if (!viewer) return;
        viewer.classList.remove('is-open');
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        lastFocus = null;
        window.setTimeout(function () {
            if (!isOpen()) imgEl.removeAttribute('src');
        }, 250);
    }

    document.addEventListener('click', function (e) {
        var target = e.target;
        if (!target || !target.closest) return;

        var link = target.closest('a[href]');
        if (!link) return;

        var href = link.getAttribute('href') || '';
        if (!IMG_EXT.test(href)) return;
        if (link.hasAttribute('data-no-viewer')) return;

        var name = link.getAttribute('download');
        if (name) name = name.replace(/\.[^.]+$/, '');

        e.preventDefault();
        open(href, name || '作业图片');
    });
})();
