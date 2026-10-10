/* 音乐下载器共享模块：主题 / 搜索历史 / Toast / 工具
   music.html（主页）· search.html（搜索）· player.html（播放）共用 */
(function () {
    'use strict';

    var HISTORY_KEY = 'musicSearchHistory';
    var HISTORY_MAX = 20;

    function $(id) { return document.getElementById(id); }

    /* ---------- 内联 SVG 图标（不使用 emoji，随 currentColor 适配深浅色） ---------- */
    function svgIcon(paths) {
        return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
    }
    var icons = {
        music: svgIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
        moon: svgIcon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
        sun: svgIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
        refresh: svgIcon('<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>'),
        download: svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
        heart: svgIcon('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
        heartFill: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
        plus: svgIcon('<path d="M5 12h14"/><path d="M12 5v14"/>'),
        pencil: svgIcon('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
        x: svgIcon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
        chevron: svgIcon('<path d="m9 18 6-6-6-6"/>'),
    };

    /* ---------- 主题（与全站其他页面同步 localStorage 'darkMode'） ---------- */
    function applyTheme(dark) {
        document.body.classList.toggle('dark-mode', dark);
        var btn = $('themeBtn');
        if (btn) btn.innerHTML = (dark ? icons.sun : icons.moon) + '<span>' + (dark ? '浅色模式' : '深色模式') + '</span>';
    }
    function initTheme() {
        applyTheme(localStorage.getItem('darkMode') === 'true');
        var btn = $('themeBtn');
        if (btn) btn.addEventListener('click', function () {
            var dark = !document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', dark);
            applyTheme(dark);
        });
    }

    /* ---------- 搜索历史（去重 / 最近在前 / 上限20） ---------- */
    function getHistory() {
        try {
            var raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            return Array.isArray(raw)
                ? raw.filter(function (h) { return typeof h === 'string' && h.trim(); })
                : [];
        } catch (e) { return []; }
    }
    function saveHistory(list) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    }
    // 点击某个历史词时调用（由页面决定跳搜索页 / 填框搜索）
    var historyOnClick = null;
    function renderHistory(onClick) {
        if (typeof onClick === 'function') historyOnClick = onClick;
        var wrap = $('historyWrap');
        var chips = $('historyChips');
        var list = getHistory();
        if (wrap) wrap.classList.toggle('hidden', list.length === 0);
        if (!chips) return;
        chips.innerHTML = '';
        list.forEach(function (k) {
            var chip = document.createElement('span');
            chip.className = 'chip';
            chip.title = k;
            var txt = document.createElement('span');
            txt.className = 'chip-txt';
            txt.textContent = k;
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'chip-del';
            del.innerHTML = icons.x;
            del.setAttribute('aria-label', '删除 ' + k);
            del.addEventListener('click', function (ev) {
                ev.stopPropagation();
                saveHistory(getHistory().filter(function (h) { return h !== k; }));
                renderHistory();
            });
            chip.appendChild(txt);
            chip.appendChild(del);
            chip.addEventListener('click', function () {
                if (historyOnClick) historyOnClick(k);
            });
            chips.appendChild(chip);
        });
    }
    function addHistory(keyword) {
        var k = (keyword || '').trim();
        if (!k) return;
        saveHistory([k].concat(getHistory().filter(function (h) { return h !== k; })).slice(0, HISTORY_MAX));
        renderHistory();
    }
    function bindHistoryClear() {
        var btn = $('historyClear');
        if (!btn) return;
        btn.addEventListener('click', function () {
            saveHistory([]);
            renderHistory();
            toast('搜索历史已清空');
        });
    }

    /* ---------- 歌单（localStorage 'musicPlaylists'） ---------- */
    var PLAYLISTS_KEY = 'musicPlaylists';
    var PLAYLIST_NAME_MAX = 20;
    var SONG_TITLE_MAX = 60;

    function defaultPlaylist() {
        return { id: 'default', name: '我喜欢', fixed: true, songs: [] };
    }
    // 清洗歌单数据：过滤非法项，缺默认歌单时补建
    function normalizePlaylists(list) {
        if (!Array.isArray(list)) return [defaultPlaylist()];
        var seenDefault = false;
        var out = [];
        list.forEach(function (p) {
            if (!p || typeof p !== 'object') return;
            var id = String(p.id || '').trim();
            var name = String(p.name || '').trim();
            if (!id || !name) return;
            var fixed = !!p.fixed;
            if (fixed && id === 'default') seenDefault = true;
            var songs = (Array.isArray(p.songs) ? p.songs : []).filter(function (s) {
                return s && typeof s === 'object' && s.id && String(s.title || '').trim();
            }).map(function (s) {
                return {
                    id: String(s.id),
                    title: String(s.title).trim().slice(0, SONG_TITLE_MAX),
                    artist: String(s.artist || '').trim(),
                };
            });
            out.push({ id: id, name: name.slice(0, PLAYLIST_NAME_MAX), fixed: fixed, songs: songs });
        });
        if (!seenDefault) out.unshift(defaultPlaylist());
        return out;
    }
    function loadPlaylists() {
        try {
            return normalizePlaylists(JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]'));
        } catch (e) {
            return [defaultPlaylist()];
        }
    }
    function savePlaylists(list) {
        localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(list));
    }
    function findPlaylist(list, id) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) return list[i];
        }
        return null;
    }
    function getAllPlaylists() {
        return loadPlaylists();
    }
    function validName(name) {
        var n = String(name || '').trim();
        if (!n) { toast('名称不能为空', true); return ''; }
        if (n.length > PLAYLIST_NAME_MAX) { toast('名称不能超过 ' + PLAYLIST_NAME_MAX + ' 个字', true); return ''; }
        return n;
    }
    function createPlaylist(name) {
        var n = validName(name);
        if (!n) return null;
        var list = loadPlaylists();
        var pl = {
            id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            name: n,
            fixed: false,
            songs: [],
        };
        list.push(pl);
        savePlaylists(list);
        return pl;
    }
    function renamePlaylist(id, name) {
        var n = validName(name);
        if (!n) return false;
        var list = loadPlaylists();
        var pl = findPlaylist(list, id);
        if (!pl) { toast('歌单不存在', true); return false; }
        if (pl.fixed) { toast('默认歌单不可重命名', true); return false; }
        pl.name = n;
        savePlaylists(list);
        return true;
    }
    function removePlaylist(id) {
        var list = loadPlaylists();
        var pl = findPlaylist(list, id);
        if (!pl) { toast('歌单不存在', true); return false; }
        if (pl.fixed) { toast('默认歌单不可删除', true); return false; }
        savePlaylists(list.filter(function (p) { return p.id !== id; }));
        return true;
    }
    function addSongToPlaylist(plId, song) {
        if (!song || !song.id || !String(song.title || '').trim()) return false;
        var s = {
            id: String(song.id),
            title: String(song.title).trim().slice(0, SONG_TITLE_MAX),
            artist: String(song.artist || '').trim(),
        };
        var list = loadPlaylists();
        var pl = findPlaylist(list, plId);
        if (!pl) return false;
        for (var i = 0; i < pl.songs.length; i++) {
            if (pl.songs[i].id === s.id) return false; // 歌单内按 id 去重
        }
        pl.songs.push(s);
        savePlaylists(list);
        return true;
    }
    function removeSongFromPlaylist(plId, songId) {
        var list = loadPlaylists();
        var pl = findPlaylist(list, plId);
        if (!pl) return false;
        var before = pl.songs.length;
        pl.songs = pl.songs.filter(function (s) { return s.id !== songId; });
        if (pl.songs.length === before) return false;
        savePlaylists(list);
        return true;
    }
    function playlistsContainingSong(songId) {
        var out = [];
        loadPlaylists().forEach(function (p) {
            for (var i = 0; i < p.songs.length; i++) {
                if (p.songs[i].id === songId) { out.push(p.id); break; }
            }
        });
        return out;
    }

    /* ---------- 弹窗（遮罩 + 面板，不用原生 alert/confirm/prompt） ---------- */
    var modalCurrent = null;
    function openModal(opts) {
        closeModal();
        var o = opts || {};
        var mask = document.createElement('div');
        mask.className = 'modal-mask';
        var panel = document.createElement('div');
        panel.className = 'modal';
        var head = document.createElement('div');
        head.className = 'modal-head';
        var title = document.createElement('span');
        title.className = 'modal-title';
        title.textContent = o.title || '';
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'modal-close';
        closeBtn.setAttribute('aria-label', '关闭');
        closeBtn.innerHTML = icons.x;
        head.appendChild(title);
        head.appendChild(closeBtn);
        panel.appendChild(head);
        if (o.body) {
            var bodyEl = document.createElement('div');
            bodyEl.className = 'modal-body';
            if (typeof o.body === 'string') bodyEl.innerHTML = o.body;
            else bodyEl.appendChild(o.body);
            panel.appendChild(bodyEl);
        }
        mask.appendChild(panel);
        document.body.appendChild(mask);
        function onKey(e) { if (e.key === 'Escape') api.close(); }
        document.addEventListener('keydown', onKey);
        mask.addEventListener('click', function (e) { if (e.target === mask) api.close(); });
        closeBtn.addEventListener('click', function () { api.close(); });
        var api = {
            el: panel,
            close: function () {
                document.removeEventListener('keydown', onKey);
                if (mask.parentNode) mask.parentNode.removeChild(mask);
                if (modalCurrent === api) modalCurrent = null;
                if (typeof o.onClose === 'function') o.onClose();
            },
        };
        modalCurrent = api;
        // 自动聚焦弹窗内第一个输入框
        var firstInput = panel.querySelector('input');
        if (firstInput) setTimeout(function () { firstInput.focus(); }, 0);
        return api;
    }
    function closeModal() {
        if (modalCurrent) {
            var m = modalCurrent;
            modalCurrent = null;
            m.close();
        }
    }

    /* ---------- Toast ---------- */
    var toastEl = null, toastTimer = null;
    function toast(msg, isErr) {
        if (!toastEl) toastEl = $('toast');
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.toggle('err', !!isErr);
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3000);
    }

    /* ---------- 工具 ---------- */
    function fmtTime(sec) {
        sec = Math.max(0, sec || 0);
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function respError(data, res) {
        return new Error((data && data.error) || ('请求失败（' + res.status + '）'));
    }

    window.MusicCommon = {
        $: $, initTheme: initTheme,
        getHistory: getHistory, saveHistory: saveHistory,
        renderHistory: renderHistory, addHistory: addHistory, bindHistoryClear: bindHistoryClear,
        Playlists: {
            getAll: getAllPlaylists,
            create: createPlaylist,
            rename: renamePlaylist,
            remove: removePlaylist,
            addSong: addSongToPlaylist,
            removeSong: removeSongFromPlaylist,
            songIn: playlistsContainingSong,
        },
        openModal: openModal, closeModal: closeModal,
        icons: icons,
        toast: toast, fmtTime: fmtTime, escapeHtml: escapeHtml, respError: respError,
    };
})();
