/* 页面内图片查看器：点整张卡片 / 图片链接，当前页弹层显示，带加载进度 */
(function () {
    'use strict';

    var IMG_EXT = /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i;

    var viewer = null;
    var imgEl = null;
    var scrollEl = null;
    var closeBtn = null;
    var loadingEl = null;
    var lastFocus = null;
    var reqId = 0;

    function build() {
        viewer = document.createElement('div');
        viewer.className = 'img-viewer';
        viewer.setAttribute('role', 'dialog');
        viewer.setAttribute('aria-modal', 'true');
        viewer.setAttribute('aria-label', '作业图片');
        viewer.innerHTML =
            '<div class="img-viewer-panel">' +
                '<div class="img-viewer-scroll">' +
                    '<div class="img-viewer-loading">加载中 0% ...</div>' +
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
        loadingEl = viewer.querySelector('.img-viewer-loading');

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

    function setLoadingText(text) {
        if (loadingEl) loadingEl.textContent = text;
    }

    /* 先探测进度，再交给 <img> 真正显示 */
    function loadImage(src, id) {
        setLoadingText('加载中 0% ...');

        imgEl.onload = function () {
            if (id !== reqId) return;
            viewer.classList.remove('is-loading');
        };
        imgEl.onerror = function () {
            if (id !== reqId) return;
            setLoadingText('图片加载失败，请稍后再试');
        };

        function attach() {
            if (id !== reqId) return;
            imgEl.setAttribute('src', src);
        }

        if (!window.XMLHttpRequest) {
            setLoadingText('加载中 ...');
            attach();
            return;
        }

        var xhr = new XMLHttpRequest();
        var settled = false;

        try {
            xhr.open('GET', src, true);
            xhr.responseType = 'blob';
        } catch (err) {
            setLoadingText('加载中 ...');
            attach();
            return;
        }

        xhr.onprogress = function (e) {
            if (settled || id !== reqId) return;
            if (!e.lengthComputable || !e.total) return;
            var pct = Math.floor(e.loaded / e.total * 100);
            if (pct > 99) pct = 99;
            setLoadingText('加载中 ' + pct + '% ...');
        };

        xhr.onloadend = function () {
            if (settled || id !== reqId) return;
            settled = true;
            var ok = xhr.status >= 200 && xhr.status < 300;
            setLoadingText(ok ? '加载中 100% ...' : '加载中 ...');
            attach();
        };

        try {
            xhr.send();
        } catch (err) {
            settled = true;
            setLoadingText('加载中 ...');
            attach();
        }
    }

    function open(src, name) {
        if (!src) return;
        if (!viewer) build();

        lastFocus = document.activeElement;
        var id = ++reqId;

        imgEl.removeAttribute('src');
        imgEl.setAttribute('alt', name || '作业图片');
        scrollEl.scrollTop = 0;
        viewer.classList.add('is-open');
        viewer.classList.add('is-loading');
        document.body.style.overflow = 'hidden';
        if (closeBtn.focus) closeBtn.focus();

        loadImage(src, id);
    }

    function close() {
        if (!viewer) return;
        reqId++;
        viewer.classList.remove('is-open');
        viewer.classList.remove('is-loading');
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        lastFocus = null;
        window.setTimeout(function () {
            if (isOpen()) return;
            imgEl.removeAttribute('src');
            setLoadingText('加载中 0% ...');
        }, 250);
    }

    function resolveOpener(node) {
        if (!node || !node.closest) return null;

        var card = node.closest('[data-img]');
        if (card) {
            return {
                src: card.getAttribute('data-img'),
                name: card.getAttribute('data-img-name') || ''
            };
        }

        var link = node.closest('a[href]');
        if (link) {
            var href = link.getAttribute('href') || '';
            if (IMG_EXT.test(href)) {
                var dl = link.getAttribute('download') || '';
                return { src: href, name: dl.replace(/\.[^.]+$/, '') };
            }
        }
        return null;
    }

    document.addEventListener('click', function (e) {
        var opener = resolveOpener(e.target);
        if (!opener) return;
        e.preventDefault();
        open(opener.src, opener.name);
    });

    /* 卡片可用键盘打开 */
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        var target = e.target;
        if (!target || !target.closest) return;
        var card = target.closest('[data-img]');
        if (!card || card !== target) return;
        e.preventDefault();
        open(card.getAttribute('data-img'), card.getAttribute('data-img-name') || '');
    });
})();
