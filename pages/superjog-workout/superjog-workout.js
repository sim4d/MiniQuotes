Page({
    data: {
        // 锻炼参数
        totalDuration: 15 * 60, // 默认15分钟（秒）
        remainingSeconds: 15 * 60, // 剩余秒数
        elapsedSeconds: 0, // 已用秒数

        // 时间显示
        remainingTime: '15:00',
        elapsedTime: '00:00',

        // 状态控制
        isRunning: false,
        isPaused: false,

        // 步频指示
        stepBeat: 1, // 1-4 循环

        // 弹窗控制
        showExitModal: false,

        // 长按计时
        longPressTimer: null,
        longPressPercent: 0,
        isLongPressing: false,

        // 鼓励文字
        encouragementText: '',
        encouragementTexts: [
            '保持节拍，你做得很棒！',
            '继续前进，感受身体的律动',
            '呼吸均匀，享受这个过程',
            '轻松愉快，不要急躁',
            '专注当下，感受每一步',
            '很好！保持这个节奏',
            '身心放松，自然前行',
            '你正在变得更健康！'
        ],

        // 嘀嗒声音的Base64编码 (短的嘀嗒声)
        tickSoundBase64: 'data:audio/wav;base64,UklGRigBAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQQBAACBgIF/gnuDdIRthGaFX4VYhVKFTIVKhUqFT4VVhV2FZoVwhXqFhYWRhZ2FqYW2hcOFz4XbhueF8oX9hQeGEYYahiOGLIY0hjyGQ4ZKhlCGVYZbhmCGZIZohmyGb4ZyhnSGdYZ2hnaGdoZ1hnSGcoZwhmyGaIZjhl6GWIZSgkyCRYI+gjaCL4IngcB/uX+xf6l/oX+af5N/jH+Gf4B/e390f24/aX9lf2F/Xn9bf1l/V39Wf1V/VX9Vf1Z/WH9af11/YH9kf2h/bX9yf3d/fX+Df4p/kX+Zf6F/qn+yf7x/xX/Pf9l/4n/sf/Z/AIAKgBSAHYAngDGAO4BFgE+AWYBjgG2Ad4CBgIqAlICdgKaArYC2gL2AxIDKgNGA14DdgOKA54DrgO+A8oDzgPWA9ID0AAAA',
    },

    // 定时器引用
    workoutTimer: null,
    beatTimer: null,
    audioContext: null,
    tickAudio: null,
    longPressEndTimer: null,

    onLoad: function (options) {
        // 从选项中获取时间，如果没有则使用默认值
        let duration = 15; // 默认15分钟
        if (options && options.duration) {
            duration = parseInt(options.duration);
        }
        const totalSeconds = duration * 60;
        this.setData({
            totalDuration: totalSeconds,
            remainingSeconds: totalSeconds,
            remainingTime: this.formatTime(totalSeconds),
            elapsedTime: '00:00',
        });

        // 初始化音频上下文
        this.initAudio();
    },

    onShow: function () {
        // 阻止息屏
        wx.setKeepScreenOn({
            keepScreenOn: true
        });

        // Ensure alert is active if returning to an active workout
        if (this.data.isRunning || this.data.isPaused) {
            try {
                wx.enableAlertBeforeUnload({
                    message: "锻炼正在进行中，确定要离开吗？进度将不会保存。"
                });
            } catch (e) {
                console.warn("enableAlertBeforeUnload failed in onShow", e);
            }
        } else {
            try {
                wx.disableAlertBeforeUnload();
            } catch (e) {
                console.warn("disableAlertBeforeUnload failed in onShow", e);
            }
        }
    },

    onHide: function () {
        this.pauseWorkout();
    },

    onUnload: function () {
        // 如果锻炼还在进行中，保存数据
        if (this.data.isRunning || this.data.isPaused) {
            this.saveWorkoutData();
        }
        
        this.cleanup();
        // Ensure alert is disabled on unload
        try {
            wx.disableAlertBeforeUnload();
        } catch (e) {
            console.warn("disableAlertBeforeUnload failed in onUnload", e);
        }
    },

    onBackPress() {
        if (this.data.isRunning || this.data.isPaused) {
            wx.showModal({
                title: "结束锻炼?",
                content: "锻炼正在进行中，返回将结束本次锻炼。确定要结束吗？",
                confirmText: "结束锻炼",
                cancelText: "继续锻炼",
                success: (res) => {
                    if (res.confirm) {
                        // User confirmed to exit, so disable alert and navigate
                        try {
                            wx.disableAlertBeforeUnload();
                        } catch (e) {
                            console.warn("disableAlertBeforeUnload failed in onBackPress confirm", e);
                        }
                        this.confirmExit(); // This will handle cleanup and navigation
                        // wx.navigateBack(); // Or let confirmExit handle navigation
                    }
                    // If res.cancel, do nothing, effectively blocking back navigation
                }
            });
            return true; // Block default back navigation to wait for modal
        }
        // If workout is not running or paused, allow normal back navigation
        try {
            wx.disableAlertBeforeUnload(); // Ensure it's off if we allow back
        } catch (e) {
            console.warn("disableAlertBeforeUnload failed in onBackPress allow", e);
        }
        return false;
    },

    // 阻止滑动返回
    onPageScroll: function(e) {
        // 如果锻炼进行中且用户尝试滑动返回，禁止此行为
        if ((this.data.isRunning || this.data.isPaused) && e && e.scrollTop < 0) {
            // 防止向下滚动（可能是尝试滑动返回的开始）
            wx.pageScrollTo({
                scrollTop: 0,
                duration: 0
            });
        }
    },

    // 初始化音频
    initAudio: function () {
        try {
            this.canPlaySound = false;
            this.validTickSoundSrc = null;

            if (!wx.createInnerAudioContext) {
                console.error('当前环境不支持createInnerAudioContext');
                return;
            }

            const audioTestInstance = wx.createInnerAudioContext();
            if (!audioTestInstance) {
                console.error('创建音频测试实例失败');
                return;
            }
            // 确保在静音模式下也能播放声音，必须在设置src之前设置
            audioTestInstance.obeyMuteSwitch = false;

            const primarySrc = 'sounds/tick.wav';
            const fallbackSrc = this.data.tickSoundBase64;

            audioTestInstance.onCanplay(() => {
                console.log(`音频 (${audioTestInstance.src}) 加载成功，可以播放`);
                this.canPlaySound = true;
                if (!this.validTickSoundSrc) { // 优先使用成功加载的src
                    this.validTickSoundSrc = audioTestInstance.src;
                }
                // 测试实例使命完成，可以销毁或置空，但小程序内音频实例销毁需谨慎
                // audioTestInstance.destroy();
            });

            audioTestInstance.onError((res) => {
                console.error(`音频 (${audioTestInstance.src}) 加载失败:`, res);
                if (audioTestInstance.src === primarySrc && fallbackSrc) {
                    console.log('尝试加载Base64备用音频');
                    audioTestInstance.src = fallbackSrc; // 再次尝试加载备用src
                } else {
                    // 如果备用src也失败，或没有备用src
                    this.canPlaySound = false;
                    this.validTickSoundSrc = null;
                    console.error('所有音频源加载失败');
                }
            });

            // 首先尝试加载外部文件
            audioTestInstance.src = primarySrc;

        } catch (error) {
            console.error('初始化音频过程出错:', error);
            this.canPlaySound = false;
            this.validTickSoundSrc = null;
        }
    },

    // 播放节拍音
    playBeatSound: function () {
        if (this.canPlaySound && this.validTickSoundSrc) { // Removed isMuted check
            const beatAudio = wx.createInnerAudioContext();
            if (beatAudio) {
                // 必须在设置src之前设置obeyMuteSwitch，确保在静音模式下也能播放
                beatAudio.obeyMuteSwitch = false;
                beatAudio.volume = 1; // Set volume to max as controls are removed
                beatAudio.src = this.validTickSoundSrc;

                beatAudio.onCanplay(() => { // 确保加载完成后再播放
                    beatAudio.play();
                });
                beatAudio.onError((res) => {
                    console.error('播放节拍音失败:', res);
                });
                // 不需要显式销毁，小程序会自动管理
            }
        }

        // 震动反馈
        try {
            wx.vibrateShort({ type: 'light' });
        } catch (error) {
            console.error('震动反馈失败', error);
        }
    },

    // 主按钮处理函数
    handleMainButton: function () {
        if (!this.data.isRunning && !this.data.isPaused) {
            // 开始状态 -> 开始锻炼
            this.startWorkout();
        } else if (this.data.isRunning) {
            // 运行状态 -> 暂停
            this.pauseWorkout();
        } else if (this.data.isPaused) {
            // 暂停状态 -> 继续
            this.resumeWorkout();
        }
    },

    // 长按按钮开始
    handleLongPress: function () {
        // 只在暂停状态下启用长按结束功能
        if (!this.data.isPaused) return;

        this.setData({
            isLongPressing: true,
            longPressPercent: 0
        });

        // 创建定时器，每100ms更新一次进度
        this.longPressTimer = setInterval(() => {
            let percent = this.data.longPressPercent + 3.33; // 每100ms增加3.33%，3秒到达100%

            if (percent >= 100) {
                // 长按完成，结束锻炼
                this.setData({
                    longPressPercent: 100,
                    isLongPressing: false
                });
                clearInterval(this.longPressTimer);
                this.confirmExit(); // 直接结束锻炼，不显示弹窗
            } else {
                this.setData({
                    longPressPercent: percent
                });
            }
        }, 100);

        // 震动反馈
        wx.vibrateShort({ type: 'heavy' });
    },

    // 长按结束
    handleTouchEnd: function () {
        if (this.longPressTimer) {
            clearInterval(this.longPressTimer);

            // 添加300ms延迟，防止长按和点击冲突
            this.longPressEndTimer = setTimeout(() => {
                this.setData({
                    isLongPressing: false,
                    longPressPercent: 0
                });
            }, 300);
        }
    },

    // 开始锻炼
    startWorkout: function () {
        if (this.data.remainingSeconds <= 0) return;

        this.setData({
            isRunning: true,
            isPaused: false
        });

        // 开始倒计时
        this.startTimer();

        // 开始节拍
        this.startBeat();

        // 显示鼓励文字
        this.showEncouragement();

        // 震动反馈
        wx.vibrateShort({
            type: 'medium'
        });

        // 启用离开确认
        try {
            wx.enableAlertBeforeUnload({
                message: "锻炼正在进行中，确定要离开吗？进度将不会保存。"
            });
        } catch (e) {
            console.warn("enableAlertBeforeUnload failed in startWorkout", e);
        }
    },

    // 暂停锻炼
    pauseWorkout: function () {
        this.setData({
            isRunning: false,
            isPaused: true
        });

        this.stopTimer();
        this.stopBeat();
    },

    // 继续锻炼
    resumeWorkout: function () {
        if (this.data.remainingSeconds <= 0) return;

        this.setData({
            isRunning: true,
            isPaused: false
        });

        this.startTimer();
        this.startBeat();

        // 启用离开确认
        try {
            wx.enableAlertBeforeUnload({
                message: "锻炼正在进行中，确定要离开吗？进度将不会保存。"
            });
        } catch (e) {
            console.warn("enableAlertBeforeUnload failed in resumeWorkout", e);
        }
    },

    // 确认退出
    confirmExit: function () {
        // 禁用离开确认
        try {
            wx.disableAlertBeforeUnload();
        } catch (e) {
            console.warn("disableAlertBeforeUnload failed in confirmExit", e);
        }
        this.cleanup();
        this.saveWorkoutData();

        // 跳转到完成页面
        wx.redirectTo({
            url: `../superjog-summary/superjog-summary?duration=${Math.floor(this.data.elapsedSeconds / 60)}&targetDuration=${Math.floor(this.data.totalDuration / 60)}&completed=${this.data.remainingSeconds <= 0}`
        });
    },

    // 开始计时器
    startTimer: function () {
        this.workoutTimer = setInterval(() => {
            if (this.data.remainingSeconds > 0) {
                const remainingSeconds = this.data.remainingSeconds - 1;
                const elapsedSeconds = this.data.elapsedSeconds + 1;

                this.setData({
                    remainingSeconds: remainingSeconds,
                    elapsedSeconds: elapsedSeconds,
                    remainingTime: this.formatTime(remainingSeconds),
                    elapsedTime: this.formatTime(elapsedSeconds)
                });

                // 每分钟显示鼓励文字
                if (elapsedSeconds % 60 === 0 && elapsedSeconds > 0) {
                    this.showEncouragement();
                }
            } else {
                // 锻炼完成
                this.completeWorkout();
            }
        }, 1000);
    },

    // 停止计时器
    stopTimer: function () {
        if (this.workoutTimer) {
            clearInterval(this.workoutTimer);
            this.workoutTimer = null;
        }
    },

    // 开始节拍
    startBeat: function () {
        // 180 BPM = 180/60 = 3次/秒 = 1次/0.333秒
        const beatInterval = 60000 / 180; // 毫秒

        this.beatTimer = setInterval(() => {
            // 播放节拍音效
            this.playBeatSound();

            // 更新步频指示器
            const nextBeat = this.data.stepBeat >= 4 ? 1 : this.data.stepBeat + 1;
            this.setData({
                stepBeat: nextBeat
            });
        }, beatInterval);
    },

    // 停止节拍
    stopBeat: function () {
        if (this.beatTimer) {
            clearInterval(this.beatTimer);
            this.beatTimer = null;
        }
    },

    // 锻炼完成
    completeWorkout: function () {
        this.setData({
            isRunning: false,
            isPaused: false,
            remainingSeconds: 0,
            remainingTime: '00:00'
        });

        this.stopTimer();
        this.stopBeat();

        // 播放完成提示音 
        wx.vibrateLong();

        // 保存记录
        this.saveWorkoutData();

        // 延迟跳转到总结页面
        setTimeout(() => {
            // 禁用离开确认
            try {
                wx.disableAlertBeforeUnload();
            } catch (e) {
                console.warn("disableAlertBeforeUnload failed in completeWorkout timeout", e);
            }
            wx.redirectTo({
                url: `../superjog-summary/superjog-summary?duration=${Math.floor(this.data.totalDuration / 60)}&completed=true`
            });
        }, 1000);
    },

    // 保存锻炼数据
    saveWorkoutData: function () {
        try {
            const workoutData = wx.getStorageSync('superjog_data') || {
                continuousDays: 0,
                totalMinutes: 0,
                lastWorkoutDate: null,
                workoutHistory: []
            };

            // 获取当前日期 
            const today = new Date();
            const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD 格式

            // 计算连续天数
            const lastDate = workoutData.lastWorkoutDate;
            if (lastDate) {
                const lastWorkoutDate = new Date(lastDate);
                const timeDiff = today.getTime() - lastWorkoutDate.getTime();
                const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

                if (daysDiff === 1) {
                    // 连续锻炼
                    workoutData.continuousDays += 1;
                } else if (daysDiff === 0) {
                    // 同一天多次锻炼，不增加连续天数
                } else {
                    // 中断了连续锻炼
                    workoutData.continuousDays = 1;
                }
            } else {
                // 第一次锻炼
                workoutData.continuousDays = 1;
            }

            // 更新锻炼总时间（分钟）
            const minutesThisWorkout = Math.floor(this.data.elapsedSeconds / 60);
            workoutData.totalMinutes = (workoutData.totalMinutes || 0) + minutesThisWorkout;

            // 更新最后锻炼日期
            workoutData.lastWorkoutDate = dateString;

            // 添加本次锻炼记录
            workoutData.workoutHistory.push({
                date: dateString,
                duration: minutesThisWorkout,
                targetDuration: Math.floor(this.data.totalDuration / 60),
                completed: this.data.remainingSeconds <= 0
            });

            // 只保留最近30条记录
            if (workoutData.workoutHistory.length > 30) {
                workoutData.workoutHistory = workoutData.workoutHistory.slice(-30);
            }

            // 保存更新后的数据
            wx.setStorageSync('superjog_data', workoutData);
        } catch (error) {
            console.error('保存锻炼数据失败:', error);
        }
    },

    // 显示随机鼓励文字
    showEncouragement: function () {
        const texts = this.data.encouragementTexts;
        const randomIndex = Math.floor(Math.random() * texts.length);
        this.setData({
            encouragementText: texts[randomIndex]
        });
    },

    // 格式化时间显示（秒 -> MM:SS）
    formatTime: function (seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    },

    // 清理工作
    cleanup: function () {
        this.stopTimer();
        this.stopBeat();

        if (this.longPressTimer) {
            clearInterval(this.longPressTimer);
        }

        if (this.longPressEndTimer) {
            clearTimeout(this.longPressEndTimer);
        }

        // 完全重构音频清理逻辑，避免使用destroy方法
        if (this.tickAudio) {
            try {
                // 只调用stop方法停止播放，不再调用destroy
                if (typeof this.tickAudio.stop === 'function') {
                    this.tickAudio.stop();
                }

                // 释放音频资源，但不使用destroy方法
                if (typeof this.tickAudio.offCanplay === 'function') {
                    this.tickAudio.offCanplay();
                }
                if (typeof this.tickAudio.offError === 'function') {
                    this.tickAudio.offError();
                }

                // 将引用置为null，让垃圾回收机制处理
                this.tickAudio = null;
            } catch (error) {
                console.error('释放音频资源时出错:', error);
                this.tickAudio = null;
            }
        }

        // 允许屏幕休眠
        wx.setKeepScreenOn({
            keepScreenOn: false
        });
    }
}); 