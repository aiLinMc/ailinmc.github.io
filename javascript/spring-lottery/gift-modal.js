(function() {
	function initTransparent() {
		var containers = document.querySelectorAll('.container, .stage-container, .canvas-container');
		containers.forEach(function(el) {
			el.style.backgroundColor = 'transparent';
		});
		var canvases = document.querySelectorAll('canvas');
		canvases.forEach(function(el) {
			el.style.backgroundColor = 'transparent';
		});
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initTransparent);
	} else {
		initTransparent();
	}
	setTimeout(initTransparent, 100);
})();

function handleGiftModalClose() {
	var modal = document.getElementById('giftModal');
	var bg = document.getElementById('newYearBg');
	var audio = document.getElementById('gift_audio');
	var floatBalls = document.getElementById('floatBalls');

	window.isImageBackground = true;

	var containers = document.querySelectorAll('.container, .stage-container, .canvas-container');
	containers.forEach(function(el) {
		el.style.backgroundColor = 'transparent';
	});

	if (bg) {
		bg.style.display = 'block';
	}

	modal.style.transition = 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
	modal.style.opacity = '0';
	modal.style.transform = 'translateY(-30px) scale(1.02)';
	setTimeout(() => modal.remove(), 800);

	setTimeout(() => {
		if (floatBalls) {
			floatBalls.classList.add('show');
		}
	}, 800);

	document.documentElement.style.transition = 'background-color 1s ease';
	document.documentElement.style.backgroundColor = '#000';
	document.body.style.transition = 'background-color 1s ease';
	document.body.style.backgroundColor = '#000';

	setTimeout(() => {
		if (bg) {
			setTimeout(() => bg.style.opacity = '1', 100);
		}
	}, 500);

	setTimeout(() => {
		if (audio) audio.play().catch(e => console.log('音频播放需要用户交互'));
	}, 1000);

	setTimeout(() => {
		if (typeof togglePause === 'function') {
			togglePause(false);
		}
		
		if (typeof updateConfig === 'function') {
			updateConfig({ autoLaunch: true, hideControls: true });
		}
		
		if (typeof launchShellFromConfig === 'function') {
			for(let i=0; i<8; i++) setTimeout(launchShellFromConfig, i * 250);
		}
	}, 2500);
}
