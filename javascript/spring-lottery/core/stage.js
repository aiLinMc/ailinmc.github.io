const Ticker = (function TickerFactory(window) {
	'use strict';

	const Ticker = {};

	Ticker.addListener = function addListener(callback) {
		if (typeof callback !== 'function') throw('Ticker.addListener() requires a function reference passed for a callback.');

		listeners.push(callback);

		if (!started) {
			started = true;
			queueFrame();
		}
	};

	let started = false;
	let lastTimestamp = 0;
	let listeners = [];

	function queueFrame() {
		if (window.requestAnimationFrame) {
			requestAnimationFrame(frameHandler);
		} else {
			webkitRequestAnimationFrame(frameHandler);
		}
	}

	function frameHandler(timestamp) {
		let frameTime = timestamp - lastTimestamp;
		lastTimestamp = timestamp;
		if (frameTime < 0) {
			frameTime = 17;
		}
		else if (frameTime > 68) {
			frameTime = 68;
		}

		listeners.forEach(listener => listener.call(window, frameTime, frameTime / 16.6667));

		queueFrame();
	}

	return Ticker;

})(window);

const Stage = (function StageFactory(window, document, Ticker) {
	'use strict';
  
	let lastTouchTimestamp = 0;

	function Stage(canvas) {
		if (typeof canvas === 'string') canvas = document.getElementById(canvas);

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
    
    this.canvas.style.touchAction = 'none';

		this.speed = 1;

		this.dpr = Stage.disableHighDPI ? 1 : ((window.devicePixelRatio || 1) / (this.ctx.backingStorePixelRatio || 1));

		this.width = canvas.width;
		this.height = canvas.height;
		this.naturalWidth = this.width * this.dpr;
		this.naturalHeight = this.height * this.dpr;

		if (this.width !== this.naturalWidth) {
			this.canvas.width = this.naturalWidth;
			this.canvas.height = this.naturalHeight;
			this.canvas.style.width = this.width + 'px';
			this.canvas.style.height = this.height + 'px';
		}

		Stage.stages.push(this);

		this._listeners = {
			resize: [],
			pointerstart: [],
			pointermove: [],
			pointerend: [],
			lastPointerPos: {x:0, y:0}
		};
	}

	Stage.stages = [];

	Stage.disableHighDPI = false;

	Stage.prototype.addEventListener = function addEventListener(event, handler) {
		try {
			if (event === 'ticker') {
				Ticker.addListener(handler);
			}else{
				this._listeners[event].push(handler);
			}
		}
		catch (e) {
			throw('Invalid Event')
		}
	};

	Stage.prototype.dispatchEvent = function dispatchEvent(event, val) {
		const listeners = this._listeners[event];
		if (listeners) {
			listeners.forEach(listener => listener.call(this, val));
		}else{
			throw('Invalid Event');
		}
	};

	Stage.prototype.resize = function resize(w, h) {
		this.width = w;
		this.height = h;
		this.naturalWidth = w * this.dpr;
		this.naturalHeight = h * this.dpr;
		this.canvas.width = this.naturalWidth;
		this.canvas.height = this.naturalHeight;
		this.canvas.style.width = w + 'px';
		this.canvas.style.height = h + 'px';

		this.dispatchEvent('resize');
	};

	Stage.windowToCanvas = function windowToCanvas(canvas, x, y) {
		const bbox = canvas.getBoundingClientRect();
		return {
				x: (x - bbox.left) * (canvas.width / bbox.width),
				y: (y - bbox.top) * (canvas.height / bbox.height)
			   };
	};
	
	Stage.mouseHandler = function mouseHandler(evt) {
    if (Date.now() - lastTouchTimestamp < 500) {
      return;
    }

		let type = 'start';
		if (evt.type === 'mousemove') {
			type = 'move';
		}else if (evt.type === 'mouseup') {
			type = 'end';
		}

		Stage.stages.forEach(stage => {
			const pos = Stage.windowToCanvas(stage.canvas, evt.clientX, evt.clientY);
			stage.pointerEvent(type, pos.x / stage.dpr, pos.y / stage.dpr);
		});
	};
	
	Stage.touchHandler = function touchHandler(evt) {
    lastTouchTimestamp = Date.now();
    
		let type = 'start';
		if (evt.type === 'touchmove') {
			type = 'move';
		}else if (evt.type === 'touchend') {
			type = 'end';
		}
	
		Stage.stages.forEach(stage => {
      for (let touch of Array.from(evt.changedTouches)) {
        let pos;
        if (type !== 'end') {
          pos = Stage.windowToCanvas(stage.canvas, touch.clientX, touch.clientY);
          stage._listeners.lastPointerPos = pos;
          if (type === 'start') stage.pointerEvent('move', pos.x / stage.dpr, pos.y / stage.dpr);
        }else{
          pos = stage._listeners.lastPointerPos;
        }
        stage.pointerEvent(type, pos.x / stage.dpr, pos.y / stage.dpr);
      }
		});
	};

	Stage.prototype.pointerEvent = function pointerEvent(type, x, y) {
		const evt = {
			type: type,
			x: x,
			y: y
		};

		evt.onCanvas = (x >= 0 && x <= this.width && y >= 0 && y <= this.height);

		this.dispatchEvent('pointer'+type, evt);
	};

	document.addEventListener('mousedown', Stage.mouseHandler);
	document.addEventListener('mousemove', Stage.mouseHandler);
	document.addEventListener('mouseup', Stage.mouseHandler);
	document.addEventListener('touchstart', Stage.touchHandler);
	document.addEventListener('touchmove', Stage.touchHandler);
	document.addEventListener('touchend', Stage.touchHandler);

	return Stage;

})(window, document, Ticker);
