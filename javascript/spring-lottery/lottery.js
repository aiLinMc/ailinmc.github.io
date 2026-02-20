const prizes = [
	{ name: '一等奖', color: '#ffd700' },
	{ name: '二等奖', color: '#c0c0c0' },
	{ name: '三等奖', color: '#cd7f32' },
	{ name: '四等奖', color: '#ff6b6b' },
	{ name: '五等奖', color: '#4ecdc4' }
];

let isDrawing = false;

function startLottery() {
	if (isDrawing) return;
	
	isDrawing = true;
	const btn = document.getElementById('lotteryBtn');
	const prizeImage = document.getElementById('prizeImage');
	const prizeText = document.getElementById('prizeText');
	const shareText = document.getElementById('shareText');
	const prizeDisplay = document.getElementById('prizeDisplay');
	
	btn.disabled = true;
	btn.textContent = '抽奖中...';
	
	prizeImage.classList.add('spinning');
	prizeText.classList.add('flashing');
	
	let count = 0;
	const maxCount = 30;
	const interval = setInterval(() => {
		const randomPrize = prizes[Math.floor(Math.random() * prizes.length)];
		prizeText.textContent = randomPrize.name;
		prizeText.style.color = randomPrize.color;
		
		count++;
		if (count >= maxCount) {
			clearInterval(interval);
			
			prizeImage.classList.remove('spinning');
			prizeText.classList.remove('flashing');
			
			const finalPrize = prizes[Math.floor(Math.random() * prizes.length)];
			prizeText.textContent = finalPrize.name;
			prizeText.style.color = finalPrize.color;
			
			prizeImage.style.display = 'none';
			prizeText.style.display = 'block';
			
			prizeText.style.animation = 'none';
			prizeText.offsetHeight;
			prizeText.style.animation = 'celebrate 0.8s ease-out forwards';
			
			prizeDisplay.style.animation = 'none';
			prizeDisplay.offsetHeight;
			prizeDisplay.style.animation = 'glow 1s ease-in-out infinite';
			
			createConfetti();
			
			setTimeout(() => {
				btn.style.display = 'none';
				shareText.style.display = 'block';
				shareText.style.animation = 'bounceIn 0.8s ease-out';
			}, 500);
			
			isDrawing = false;
		}
	}, 100);
}

function createConfetti() {
	const colors = ['#ff6b6b', '#ffd700', '#4ecdc4', '#667eea', '#ff8e53'];
	const container = document.body;
	
	for (let i = 0; i < 50; i++) {
		const confetti = document.createElement('div');
		confetti.className = 'confetti';
		confetti.style.left = Math.random() * 100 + 'vw';
		confetti.style.top = '-20px';
		confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
		confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
		confetti.style.animationDelay = Math.random() * 0.5 + 's';
		
		container.appendChild(confetti);
		
		setTimeout(() => {
			confetti.remove();
		}, 4000);
	}
}

const style = document.createElement('style');
style.textContent = `
	.confetti {
		position: fixed;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		animation: confettiFall linear forwards;
		z-index: 1000;
	}
	
	@keyframes confettiFall {
		0% {
			transform: translateY(0) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translateY(100vh) rotate(720deg);
			opacity: 0;
		}
	}
`;
document.head.appendChild(style);
