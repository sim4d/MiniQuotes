// pages/tetris/tetris.js
Page({
    data: {
        // 游戏状态
        gameAreaWidth: 0,
        gameAreaHeight: 0,
        nextBlockSize: 60,
        score: 0,
        level: 1, // 保留level变量用于游戏逻辑，但不在界面显示
        highScore: 0,
        gameOver: false,
        isPaused: false,
        isSoundOn: true,
        showFireworks: false,

        // 游戏配置
        gridSize: 15, // 方块大小
        gridRows: 20,
        gridCols: 10,

        // 方块坐标和下一个方块
        currentBlock: null,
        nextBlock: null,

        // 游戏网格数据
        grid: [],
        highScores: []
    },

    // 游戏常量和变量
    gameLoop: null,
    dropInterval: 1000, // 初始下落速度 (ms)
    lastMoveTime: 0,
    moveDelay: 100, // 移动延迟 (ms)
    difficultyFactor: 20, // 难度系数，值越小难度增加越慢

    tetriminoColors: [
        '#ff6b8b', // I - 粉红色
        '#3b82f6', // J - 蓝色
        '#fbbf24', // L - 黄色
        '#10b981', // O - 绿色
        '#8b5cf6', // S - 紫色
        '#ec4899', // T - 粉色
        '#f97316'  // Z - 橙色
    ],

    // 方块形状定义 - 标准俄罗斯方块的7种形状
    tetriminos: [
        // I 形状
        [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        // J 形状
        [
            [1, 0, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        // L 形状
        [
            [0, 0, 1],
            [1, 1, 1],
            [0, 0, 0]
        ],
        // O 形状
        [
            [1, 1],
            [1, 1]
        ],
        // S 形状
        [
            [0, 1, 1],
            [1, 1, 0],
            [0, 0, 0]
        ],
        // T 形状
        [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        // Z 形状
        [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 0]
        ]
    ],

    // 音效
    sounds: {
        move: null,
        rotate: null,
        drop: null,
        clear: null,
        gameOver: null,
        levelUp: null,
        highScore: null
    },

    // 生命周期函数
    onLoad: function () {
        console.log('俄罗斯方块游戏页面加载');

        // 初始化界面尺寸
        this.initGameArea();

        // 初始化游戏数据
        this.initGame();

        // 加载最高分
        this.loadHighScore();

        // 初始化音效
        this.initSounds();
    },

    onReady: function () {
        console.log('俄罗斯方块游戏页面已准备好');
    },

    onShow: function () {
        console.log('俄罗斯方块游戏页面显示');
        // 如果游戏已暂停，继续游戏
        if (this.data.isPaused && !this.data.gameOver) {
            this.resumeGame();
        }
    },

    onHide: function () {
        // 如果游戏正在进行，暂停游戏
        if (!this.data.isPaused && !this.data.gameOver) {
            this.pauseGame();
        }
    },

    onUnload: function () {
        // 清除游戏循环
        this.clearGameLoop();

        // 停止烟花动画
        this.stopFireworks();
    },

    // 初始化游戏区域大小
    initGameArea: function () {
        const systemInfo = wx.getSystemInfoSync();
        const screenWidth = systemInfo.windowWidth;
        const screenHeight = systemInfo.windowHeight;

        // 计算游戏区域尺寸，保持10:20的比例，但限制高度
        // 扩大游戏区域，同时保持整体布局
        let gameAreaWidth = screenWidth * 0.68; // 从62%增加到68%

        // 限制游戏区域高度不超过屏幕高度的42%，适当增加高度
        if (gameAreaWidth > screenHeight * 0.42) {
            gameAreaWidth = screenHeight * 0.42;
        }

        const gridSize = gameAreaWidth / this.data.gridCols;
        const gameAreaHeight = gridSize * this.data.gridRows;

        // 计算下一个方块预览区域大小
        const nextBlockSize = Math.min(65, gameAreaWidth * 0.35); // 调整下一个方块预览区域

        this.setData({
            gameAreaWidth: gameAreaWidth,
            gameAreaHeight: gameAreaHeight,
            gridSize: gridSize,
            nextBlockSize: nextBlockSize
        });
    },

    // 初始化游戏数据
    initGame: function () {
        // 创建空网格
        const grid = [];
        for (let row = 0; row < this.data.gridRows; row++) {
            grid.push(new Array(this.data.gridCols).fill(0));
        }

        // 随机生成当前方块和下一个方块
        const currentBlock = this.generateRandomBlock();
        const nextBlock = this.generateRandomBlock();

        // 重置游戏状态
        this.setData({
            grid: grid,
            currentBlock: currentBlock,
            nextBlock: nextBlock,
            score: 0,
            level: 1,
            gameOver: false,
            isPaused: false,
            showFireworks: false
        });

        // 重置下落速度
        this.dropInterval = 1000; // 确保每次游戏开始时重置为初始速度

        // 在下一帧初始化画布
        setTimeout(() => {
            this.initCanvas();
            this.initNextBlockCanvas();
            this.drawGame();
            this.startGameLoop();
        }, 100);
    },

    // 初始化音效
    initSounds: function () {
        // 初始化各种音效
        this.sounds.move = wx.createInnerAudioContext();
        this.sounds.move.src = 'https://assets.easygoing.fun/sounds/tetris/move.mp3';

        this.sounds.rotate = wx.createInnerAudioContext();
        this.sounds.rotate.src = 'https://assets.easygoing.fun/sounds/tetris/rotate.mp3';

        this.sounds.drop = wx.createInnerAudioContext();
        this.sounds.drop.src = 'https://assets.easygoing.fun/sounds/tetris/drop.mp3';

        this.sounds.clear = wx.createInnerAudioContext();
        this.sounds.clear.src = 'https://assets.easygoing.fun/sounds/tetris/clear.mp3';

        this.sounds.gameOver = wx.createInnerAudioContext();
        this.sounds.gameOver.src = 'https://assets.easygoing.fun/sounds/tetris/game_over.mp3';

        this.sounds.levelUp = wx.createInnerAudioContext();
        this.sounds.levelUp.src = 'https://assets.easygoing.fun/sounds/tetris/level_up.mp3';

        this.sounds.highScore = wx.createInnerAudioContext();
        this.sounds.highScore.src = 'https://assets.easygoing.fun/sounds/tetris/high_score.mp3';
    },

    // 播放音效
    playSound: function (soundName) {
        if (this.data.isSoundOn && this.sounds[soundName]) {
            this.sounds[soundName].stop();
            this.sounds[soundName].play();
        }
    },

    // 初始化主游戏画布
    initCanvas: function () {
        const query = wx.createSelectorQuery();
        query.select('#tetris-canvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res[0]) {
                    console.error('无法获取游戏画布元素');
                    return;
                }

                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');

                // 设置画布尺寸
                canvas.width = this.data.gameAreaWidth;
                canvas.height = this.data.gameAreaHeight;

                this.canvas = canvas;
                this.ctx = ctx;
                console.log('游戏主画布已初始化，尺寸:', canvas.width, 'x', canvas.height);
            });
    },

    // 初始化下一个方块预览画布
    initNextBlockCanvas: function () {
        const query = wx.createSelectorQuery();
        query.select('#next-block-canvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res[0]) {
                    console.error('无法获取下一个方块预览画布元素');
                    return;
                }

                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');

                // 设置画布尺寸
                canvas.width = this.data.nextBlockSize;
                canvas.height = this.data.nextBlockSize;

                this.nextBlockCanvas = canvas;
                this.nextBlockCtx = ctx;

                // 绘制下一个方块
                this.drawNextBlock();
                console.log('下一个方块预览画布已初始化，尺寸:', canvas.width, 'x', canvas.height);
            });
    },

    // 游戏主循环
    startGameLoop: function () {
        // 清除之前的游戏循环
        this.clearGameLoop();

        // 更新游戏状态的时间间隔，会随等级提高而加快
        let lastDropTime = Date.now();

        // 创建新的游戏循环
        this.gameLoop = setInterval(() => {
            if (this.data.isPaused || this.data.gameOver) return;

            const now = Date.now();
            if (now - lastDropTime > this.calculateDropInterval()) {
                this.moveBlockDown();
                lastDropTime = now;
            }
        }, 16); // 约60fps
    },

    // 清除游戏循环
    clearGameLoop: function () {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    },

    // 计算下落速度间隔，随等级提高而加快，但速度增加更加缓慢
    calculateDropInterval: function () {
        // 使用更缓慢的难度曲线
        // 原来是: this.dropInterval - (this.data.level - 1) * 50
        // 新的公式使用对数增长，确保难度增加更加平缓
        const levelFactor = Math.log(this.data.level + 1) * this.difficultyFactor;
        return Math.max(200, this.dropInterval - levelFactor);
    },

    // 随机生成新方块
    generateRandomBlock: function () {
        const blockType = Math.floor(Math.random() * this.tetriminos.length);
        const tetrimino = this.tetriminos[blockType];
        const color = this.tetriminoColors[blockType];

        // 计算初始位置，使方块在顶部中间
        const x = Math.floor((this.data.gridCols - tetrimino[0].length) / 2);
        const y = 0;

        return {
            type: blockType,
            shape: tetrimino,
            x: x,
            y: y,
            color: color
        };
    },

    // 绘制游戏
    drawGame: function () {
        if (!this.ctx) return;

        const ctx = this.ctx;
        const gridSize = this.data.gridSize;

        // 清空画布
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制背景网格
        this.drawGrid();

        // 绘制已固定的方块
        this.drawFixedBlocks();

        // 绘制当前活动方块
        this.drawCurrentBlock();
    },

    // 绘制背景网格
    drawGrid: function () {
        const ctx = this.ctx;
        const gridSize = this.data.gridSize;
        const rows = this.data.gridRows;
        const cols = this.data.gridCols;

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 0.5;

        // 绘制垂直线
        for (let x = 0; x <= cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * gridSize, 0);
            ctx.lineTo(x * gridSize, rows * gridSize);
            ctx.stroke();
        }

        // 绘制水平线
        for (let y = 0; y <= rows; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * gridSize);
            ctx.lineTo(cols * gridSize, y * gridSize);
            ctx.stroke();
        }
    },

    // 绘制已固定的方块
    drawFixedBlocks: function () {
        const ctx = this.ctx;
        const gridSize = this.data.gridSize;
        const grid = this.data.grid;

        for (let row = 0; row < this.data.gridRows; row++) {
            for (let col = 0; col < this.data.gridCols; col++) {
                if (grid[row][col]) {
                    const color = this.tetriminoColors[grid[row][col] - 1];
                    this.drawBlock(ctx, col, row, color);
                }
            }
        }
    },

    // 绘制当前活动方块
    drawCurrentBlock: function () {
        if (!this.data.currentBlock) return;

        const ctx = this.ctx;
        const block = this.data.currentBlock;
        const shape = block.shape;

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = block.x + col;
                    const y = block.y + row;
                    this.drawBlock(ctx, x, y, block.color);
                }
            }
        }
    },

    // 绘制单个方块
    drawBlock: function (ctx, x, y, color) {
        const gridSize = this.data.gridSize;
        const blockSize = gridSize - 1;

        // 方块主体
        ctx.fillStyle = color;
        ctx.fillRect(x * gridSize, y * gridSize, blockSize, blockSize);

        // 方块亮边
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(x * gridSize, y * gridSize, blockSize, 2);
        ctx.fillRect(x * gridSize, y * gridSize, 2, blockSize);

        // 方块暗边
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(x * gridSize + blockSize - 2, y * gridSize, 2, blockSize);
        ctx.fillRect(x * gridSize, y * gridSize + blockSize - 2, blockSize, 2);
    },

    // 绘制下一个方块预览
    drawNextBlock: function () {
        if (!this.nextBlockCtx || !this.data.nextBlock) return;

        const ctx = this.nextBlockCtx;
        const block = this.data.nextBlock;
        const shape = block.shape;
        const canvas = this.nextBlockCanvas;

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 计算方块大小和偏移，使其居中
        const blockCount = Math.max(shape.length, shape[0].length);
        const blockSize = Math.min(canvas.width, canvas.height) / (blockCount + 2);
        const offsetX = (canvas.width - shape[0].length * blockSize) / 2;
        const offsetY = (canvas.height - shape.length * blockSize) / 2;

        // 绘制方块
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    // 方块主体
                    ctx.fillStyle = block.color;
                    ctx.fillRect(offsetX + col * blockSize, offsetY + row * blockSize, blockSize - 1, blockSize - 1);

                    // 方块亮边
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.fillRect(offsetX + col * blockSize, offsetY + row * blockSize, blockSize - 1, 2);
                    ctx.fillRect(offsetX + col * blockSize, offsetY + row * blockSize, 2, blockSize - 1);

                    // 方块暗边
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                    ctx.fillRect(offsetX + col * blockSize + blockSize - 3, offsetY + row * blockSize, 2, blockSize - 1);
                    ctx.fillRect(offsetX + col * blockSize, offsetY + row * blockSize + blockSize - 3, blockSize - 1, 2);
                }
            }
        }
    },

    // 移动方块向下
    moveBlockDown: function () {
        if (this.data.gameOver || this.data.isPaused) return;

        const block = this.data.currentBlock;
        if (!block) {
            console.log('当前没有活动方块，尝试生成新方块');
            this.generateNextBlock();
            return;
        }

        // 检查是否可以向下移动
        if (this.canMoveBlock(block.x, block.y + 1, block.shape)) {
            // 更新方块位置
            block.y += 1;
            this.setData({
                currentBlock: block
            });

            // 重绘游戏
            this.drawGame();
        } else {
            console.log('方块无法继续下落，准备固定');
            // 不能向下移动，固定方块
            this.fixBlock();
        }
    },

    // 移动方块向左
    moveLeft: function () {
        if (this.data.gameOver || this.data.isPaused) return;

        const now = Date.now();
        if (now - this.lastMoveTime < this.moveDelay) return;
        this.lastMoveTime = now;

        const block = this.data.currentBlock;

        // 检查是否可以向左移动
        if (this.canMoveBlock(block.x - 1, block.y, block.shape)) {
            // 更新方块位置
            block.x -= 1;
            this.setData({
                currentBlock: block
            });

            // 播放移动音效
            this.playSound('move');

            // 重绘游戏
            this.drawGame();
        }
    },

    // 移动方块向右
    moveRight: function () {
        if (this.data.gameOver || this.data.isPaused) return;

        const now = Date.now();
        if (now - this.lastMoveTime < this.moveDelay) return;
        this.lastMoveTime = now;

        const block = this.data.currentBlock;

        // 检查是否可以向右移动
        if (this.canMoveBlock(block.x + 1, block.y, block.shape)) {
            // 更新方块位置
            block.x += 1;
            this.setData({
                currentBlock: block
            });

            // 播放移动音效
            this.playSound('move');

            // 重绘游戏
            this.drawGame();
        }
    },

    // 旋转方块
    rotateBlock: function () {
        if (this.data.gameOver || this.data.isPaused) return;

        const block = this.data.currentBlock;

        // 特殊处理O形状，不需要旋转
        if (block.type === 3) return;

        // 获取旋转后的形状
        const rotatedShape = this.getRotatedShape(block.shape);

        // 检查旋转后是否有效
        if (this.canMoveBlock(block.x, block.y, rotatedShape)) {
            // 更新方块形状
            block.shape = rotatedShape;
            this.setData({
                currentBlock: block
            });

            // 播放旋转音效
            this.playSound('rotate');

            // 重绘游戏
            this.drawGame();
        }
    },

    // 获取旋转后的方块形状
    getRotatedShape: function (shape) {
        const rows = shape.length;
        const cols = shape[0].length;

        // 创建新数组存储旋转后的形状
        const rotated = [];
        for (let i = 0; i < cols; i++) {
            rotated[i] = [];
            for (let j = 0; j < rows; j++) {
                rotated[i][j] = shape[rows - 1 - j][i];
            }
        }

        return rotated;
    },

    // 检查方块是否可以移动
    canMoveBlock: function (x, y, shape) {
        const gridSize = this.data.gridSize;
        const grid = this.data.grid;

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const gridX = x + col;
                    const gridY = y + row;
                    if (gridX < 0 || gridX >= this.data.gridCols || gridY < 0 || gridY >= this.data.gridRows || grid[gridY][gridX]) {
                        return false;
                    }
                }
            }
        }
        return true;
    },

    // 固定方块
    fixBlock: function () {
        if (!this.data.currentBlock) return;

        const block = this.data.currentBlock;
        const shape = block.shape;
        const grid = this.data.grid;

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const gridX = block.x + col;
                    const gridY = block.y + row;
                    grid[gridY][gridX] = block.type + 1;
                }
            }
        }

        this.setData({
            grid: grid,
            currentBlock: null
        });

        // 重绘游戏
        this.drawGame();

        // 检查是否需要消除行
        this.checkLines();

        // 生成下一个方块
        this.generateNextBlock();
    },

    // 生成下一个方块
    generateNextBlock: function () {
        // 获取当前的"下一个方块"作为新的当前方块
        const currentBlock = this.data.nextBlock;

        // 生成新的"下一个方块"
        const nextBlock = this.generateRandomBlock();

        console.log('生成新方块:', currentBlock.type, '下一个:', nextBlock.type);

        // 检查游戏是否结束（新方块是否能放置）
        if (!this.canMoveBlock(currentBlock.x, currentBlock.y, currentBlock.shape)) {
            console.log('新方块无法放置，游戏结束');
            // 游戏结束
            this.handleGameOver();
            return;
        }

        // 更新数据
        this.setData({
            currentBlock: currentBlock,
            nextBlock: nextBlock
        }, () => {
            console.log('已更新当前方块和下一个方块');
            // 重绘游戏和下一个方块预览
            this.drawGame();
            this.drawNextBlock();
        });
    },

    // 处理游戏结束
    handleGameOver: function () {
        console.log('游戏结束，最终得分:', this.data.score);

        // 播放游戏结束音效
        this.playSound('gameOver');

        // 设置游戏结束状态
        this.setData({
            gameOver: true
        });

        // 保存最高分
        this.saveHighScore();

        // 如果创造了新的高分，显示烟花庆祝
        // 只有当当前分数是历史前5名时才显示烟花
        const isTopScore = this.data.highScores[0] === this.data.score && this.data.score > 0;

        if (isTopScore) {
            this.setData({
                showFireworks: true
            });

            // 初始化烟花动画
            setTimeout(() => {
                this.initFireworks();
            }, 500);

            // 设置自动停止烟花动画的定时器
            setTimeout(() => {
                this.stopFireworks();
            }, this.fireworkDuration);
        }

        // 清除游戏循环
        this.clearGameLoop();
    },

    // 检查是否需要消除行
    checkLines: function () {
        const grid = this.data.grid;
        const rows = this.data.gridRows;
        const cols = this.data.gridCols;

        let lines = 0;
        for (let row = 0; row < rows; row++) {
            if (grid[row].every(cell => cell !== 0)) {
                lines++;
                this.removeLine(row);
            }
        }

        if (lines > 0) {
            this.playSound('clear');
            this.addScore(lines);
        }
    },

    // 移除一行
    removeLine: function (row) {
        const grid = this.data.grid;
        const rows = this.data.gridRows;
        const cols = this.data.gridCols;

        for (let y = row; y > 0; y--) {
            for (let x = 0; x < cols; x++) {
                grid[y][x] = grid[y - 1][x];
            }
        }
        for (let x = 0; x < cols; x++) {
            grid[0][x] = 0;
        }

        this.setData({
            grid: grid
        });

        // 重绘游戏
        this.drawGame();
    },

    // 添加分数
    addScore: function (lines) {
        const score = this.data.score;
        const level = this.data.level;

        let newScore = 0;
        if (lines === 1) {
            newScore = 100;
        } else if (lines === 2) {
            newScore = 300;
        } else if (lines === 3) {
            newScore = 500;
        } else if (lines === 4) {
            newScore = 800;
        }

        const totalScore = score + newScore;

        // 调整关卡提升速度，每消除10行才提升一级
        // 原来是直接用消除的行数增加等级
        const newLevel = Math.floor(totalScore / 1000) + 1;

        this.setData({
            score: totalScore,
            level: newLevel
        });

        // 检查是否达到升级条件
        if (newLevel > level) {
            this.playSound('levelUp');
        }

        // 检查是否达到最高分
        if (totalScore > this.data.highScore) {
            this.playSound('highScore');
            this.setData({
                highScore: totalScore
            });
        }
    },

    // 加载最高分
    loadHighScore: function () {
        // 获取历史最高分记录数组，如果不存在则初始化为空数组
        const highScores = wx.getStorageSync('tetrisHighScores') || [];

        // 如果是旧版本数据格式(单个分数)，则转换为数组格式
        if (typeof highScores === 'number') {
            this.setData({
                highScore: highScores,
                highScores: [highScores]
            });
        } else {
            // 设置当前最高分为数组中的最高分(如果数组不为空)
            const highScore = highScores.length > 0 ? highScores[0] : 0;
            this.setData({
                highScore: highScore,
                highScores: highScores
            });
        }
    },

    // 保存最高分
    saveHighScore: function () {
        const currentScore = this.data.score;

        // 如果分数为0，不记录
        if (currentScore <= 0) return;

        // 获取现有的高分记录
        let highScores = this.data.highScores || [];

        // 添加当前分数
        highScores.push(currentScore);

        // 排序(从高到低)
        highScores.sort((a, b) => b - a);

        // 只保留前5个最高分
        highScores = highScores.slice(0, 5);

        // 更新数据
        this.setData({
            highScore: highScores[0] || 0,
            highScores: highScores
        });

        // 保存到本地存储
        wx.setStorageSync('tetrisHighScores', highScores);
    },

    // 暂停游戏
    pauseGame: function () {
        this.setData({
            isPaused: true
        });
        this.clearGameLoop();

        // 如果有烟花动画，暂停时也停止
        if (this.data.showFireworks) {
            this.stopFireworks();
        }
    },

    // 继续游戏
    resumeGame: function () {
        this.setData({
            isPaused: false
        });
        this.startGameLoop();
    },

    // 快速下落方块
    dropBlock: function () {
        if (this.data.gameOver || this.data.isPaused) return;

        // 直接下落到底部
        const block = this.data.currentBlock;
        let newY = block.y;

        // 寻找可以放置的最低位置
        while (this.canMoveBlock(block.x, newY + 1, block.shape)) {
            newY++;
        }

        if (newY > block.y) {
            // 更新方块位置
            block.y = newY;
            this.setData({
                currentBlock: block
            });

            // 播放下落音效
            this.playSound('drop');

            // 重绘游戏并固定方块
            this.drawGame();
            this.fixBlock();
        }
    },

    // 切换暂停状态
    togglePause: function () {
        if (this.data.gameOver) return;

        if (this.data.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    },

    // 切换声音状态
    toggleSound: function () {
        this.setData({
            isSoundOn: !this.data.isSoundOn
        });
    },

    // 重新开始游戏
    restartGame: function () {
        // 保存最高分
        this.saveHighScore();

        // 停止烟花动画
        this.stopFireworks();

        // 初始化游戏
        this.initGame();
    },

    // 初始化烟花动画
    initFireworks: function () {
        const query = wx.createSelectorQuery();
        query.select('#fireworks-canvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res[0] || !this.data.showFireworks) return;

                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');

                // 设置画布尺寸
                const systemInfo = wx.getSystemInfoSync();
                canvas.width = systemInfo.windowWidth;
                canvas.height = systemInfo.windowHeight;

                this.fireworksCanvas = canvas;
                this.fireworksCtx = ctx;

                // 开始烟花动画
                this.startFireworks();
            });
    },

    // 烟花动画数据
    fireworks: [],
    particles: [],
    fireworkTimer: null,
    fireworkDuration: 5000, // 烟花持续时间，5秒后自动停止

    // 开始烟花动画
    startFireworks: function () {
        // 清除之前的定时器
        if (this.fireworkTimer) {
            clearInterval(this.fireworkTimer);
        }

        // 初始化烟花数据
        this.fireworks = [];
        this.particles = [];

        // 设置自动停止计时器
        setTimeout(() => {
            this.stopFireworks();
        }, this.fireworkDuration);

        // 启动烟花动画循环
        this.fireworkTimer = setInterval(() => {
            if (!this.data.showFireworks || !this.fireworksCtx) {
                clearInterval(this.fireworkTimer);
                return;
            }

            // 随机创建新烟花
            if (Math.random() < 0.05) {
                const x = Math.random() * this.fireworksCanvas.width;
                const y = this.fireworksCanvas.height;
                const targetY = 50 + Math.random() * (this.fireworksCanvas.height / 2);

                this.fireworks.push({
                    x: x,
                    y: y,
                    targetX: x,
                    targetY: targetY,
                    speed: 2 + Math.random() * 4,
                    radius: 2,
                    color: `hsl(${Math.random() * 360}, 100%, 50%)`
                });
            }

            // 清空画布
            this.fireworksCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            this.fireworksCtx.fillRect(0, 0, this.fireworksCanvas.width, this.fireworksCanvas.height);

            // 更新和绘制烟花
            this.updateFireworks();

        }, 16); // 约60fps
    },

    // 停止烟花动画
    stopFireworks: function () {
        // 清除动画定时器
        if (this.fireworkTimer) {
            clearInterval(this.fireworkTimer);
            this.fireworkTimer = null;
        }

        // 隐藏烟花
        this.setData({
            showFireworks: false
        });

        // 清空烟花数据
        this.fireworks = [];
        this.particles = [];
    },

    // 更新烟花位置和状态
    updateFireworks: function () {
        // 更新烟花
        for (let i = this.fireworks.length - 1; i >= 0; i--) {
            const firework = this.fireworks[i];

            // 计算与目标的距离
            const dx = firework.targetX - firework.x;
            const dy = firework.targetY - firework.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 如果到达目标，创建爆炸粒子
            if (distance < 5) {
                this.createParticles(firework.x, firework.y, firework.color);
                this.fireworks.splice(i, 1);
                continue;
            }

            // 移动烟花
            const angle = Math.atan2(dy, dx);
            firework.x += Math.cos(angle) * firework.speed;
            firework.y += Math.sin(angle) * firework.speed;

            // 绘制烟花
            this.fireworksCtx.beginPath();
            this.fireworksCtx.arc(firework.x, firework.y, firework.radius, 0, Math.PI * 2);
            this.fireworksCtx.fillStyle = firework.color;
            this.fireworksCtx.fill();
        }

        // 更新粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            // 移动粒子
            particle.x += particle.vx;
            particle.y += particle.vy;

            // 应用重力和阻力
            particle.vy += 0.1;
            particle.vx *= 0.99;
            particle.vy *= 0.99;

            // 淡出效果
            particle.alpha -= 0.01;

            // 如果完全透明，移除粒子
            if (particle.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // 绘制粒子
            this.fireworksCtx.beginPath();
            this.fireworksCtx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.fireworksCtx.fillStyle = `hsla(${particle.hue}, 100%, 50%, ${particle.alpha})`;
            this.fireworksCtx.fill();
        }
    },

    // 创建爆炸粒子
    createParticles: function (x, y, color) {
        const hue = parseInt(color.match(/\d+/)[0]);
        const particleCount = 50 + Math.floor(Math.random() * 50);

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 5;

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1 + Math.random() * 2,
                hue: hue + Math.random() * 30 - 15,
                alpha: 1
            });
        }
    },

    // 触摸事件处理 - 开始触摸
    onTouchStart: function (e) {
        if (this.data.gameOver || this.data.isPaused) return;

        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
    },

    // 触摸事件处理 - 触摸移动
    onTouchMove: function (e) {
        if (this.data.gameOver || this.data.isPaused) return;
        if (!this.touchStartX) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - this.touchStartX;
        const deltaY = currentY - this.touchStartY;

        // 水平移动检测
        if (Math.abs(deltaX) > 30) {
            if (deltaX > 0) {
                this.moveRight();
            } else {
                this.moveLeft();
            }
            this.touchStartX = currentX;
            this.touchStartY = currentY;
        }

        // 下滑检测
        if (deltaY > 50) {
            this.dropBlock();
            this.touchStartX = currentX;
            this.touchStartY = currentY;
        }
    },

    // 触摸事件处理 - 结束触摸
    onTouchEnd: function (e) {
        if (this.data.gameOver || this.data.isPaused) return;

        // 检测是否为点击（短时间触摸）
        const touchDuration = Date.now() - this.touchStartTime;
        if (touchDuration < 200) {
            this.rotateBlock();
        }

        this.touchStartX = null;
        this.touchStartY = null;
    }
})