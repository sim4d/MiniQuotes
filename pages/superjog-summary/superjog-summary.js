Page({
    data: {
        // 基本信息
        actualDuration: 0,
        targetDuration: 0,
        isCompleted: false,
        currentDate: '',

        // 计算数据
        completionRate: 0,
        estimatedCalories: 0,

        // 总体统计
        totalDays: 0,
        totalMinutes: 0,
        totalWorkouts: 0,

        // 文本内容
        encouragementMessage: '',
        healthTip: '',

        // 成就
        newAchievement: null,

        // 鼓励语和健康提示
        encouragementMessages: [
            '太棒了！你正在养成健康的运动习惯',
            '每一次锻炼都让你更接近理想的自己',
            '坚持就是胜利，你做得很好！',
            '运动让生活更美好，继续加油！',
            '你的身体会感谢你今天的努力',
            '小步快跑，健康人生！',
            '规律运动是最好的投资',
            '你正在变得更强壮、更健康！'
        ],

        healthTips: [
            '运动后记得补充水分，保持身体水分平衡',
            '超慢跑后可以做些拉伸运动，放松肌肉',
            '规律的运动有助于改善睡眠质量',
            '建议每周进行3-5次超慢跑锻炼',
            '运动前后适量补充蛋白质有助于肌肉恢复',
            '保持良好的呼吸节奏，享受运动过程',
            '运动强度应循序渐进，避免过度疲劳',
            '结合均衡饮食，运动效果会更好'
        ]
    },

    onLoad: function (options) {
        // 获取传递的参数
        const duration = parseInt(options.duration) || 0;
        const completed = options.completed === 'true';

        this.setData({
            actualDuration: duration,
            targetDuration: parseInt(options.targetDuration) || duration,
            isCompleted: completed,
            currentDate: this.formatDate(new Date())
        });

        // 加载数据并计算
        this.loadSummaryData();
        this.calculateStats();
        this.checkForAchievements();
        this.setRandomTexts();
    },

    // 加载总结数据
    loadSummaryData: function () {
        try {
            const workoutData = wx.getStorageSync('superjog_data') || {
                continuousDays: 0,
                totalMinutes: 0,
                workoutHistory: []
            };

            this.setData({
                totalDays: workoutData.continuousDays || 0,
                totalMinutes: workoutData.totalMinutes || 0,
                totalWorkouts: workoutData.workoutHistory ? workoutData.workoutHistory.length : 0
            });
        } catch (error) {
            console.error('加载总结数据失败:', error);
        }
    },

    // 计算统计数据
    calculateStats: function () {
        const { actualDuration, targetDuration } = this.data;

        // 计算完成度
        const completionRate = targetDuration > 0 ? Math.round((actualDuration / targetDuration) * 100) : 100;

        // 估算卡路里消耗 (超慢跑大约每分钟消耗5-8卡路里，取平均值6.5)
        const estimatedCalories = Math.round(actualDuration * 6.5);

        this.setData({
            completionRate: Math.min(completionRate, 100),
            estimatedCalories: estimatedCalories
        });
    },

    // 检查新成就
    checkForAchievements: function () {
        const { totalDays, totalMinutes, totalWorkouts, actualDuration } = this.data;
        let newAchievement = null;

        // 定义成就条件
        const achievements = [
            {
                id: 'first_workout',
                name: '初次尝试',
                description: '完成第一次超慢跑锻炼',
                condition: () => totalWorkouts === 1
            },
            {
                id: 'three_days',
                name: '坚持三天',
                description: '连续锻炼3天',
                condition: () => totalDays === 3
            },
            {
                id: 'one_week',
                name: '一周达成',
                description: '连续锻炼7天',
                condition: () => totalDays === 7
            },
            {
                id: 'one_month',
                name: '月度坚持',
                description: '连续锻炼30天',
                condition: () => totalDays === 30
            },
            {
                id: 'hundred_minutes',
                name: '百分钟里程碑',
                description: '累计锻炼100分钟',
                condition: () => totalMinutes >= 100 && totalMinutes - actualDuration < 100
            },
            {
                id: 'long_workout',
                name: '长时间锻炼',
                description: '单次锻炼超过20分钟',
                condition: () => actualDuration >= 20
            },
            {
                id: 'ten_workouts',
                name: '十次达成',
                description: '完成10次锻炼',
                condition: () => totalWorkouts === 10
            },
            {
                id: 'five_hundred_minutes',
                name: '五百分钟达人',
                description: '累计锻炼500分钟',
                condition: () => totalMinutes >= 500 && totalMinutes - actualDuration < 500
            }
        ];

        // 检查是否满足成就条件
        for (let achievement of achievements) {
            if (achievement.condition()) {
                newAchievement = achievement;
                break;
            }
        }

        if (newAchievement) {
            this.setData({
                newAchievement: newAchievement
            });

            // 保存已获得的成就
            this.saveAchievement(newAchievement.id);

            // 震动反馈
            setTimeout(() => {
                wx.vibrateShort({
                    type: 'heavy'
                });
            }, 1000);
        }
    },

    // 保存成就数据
    saveAchievement: function (achievementId) {
        try {
            const achievements = wx.getStorageSync('superjog_achievements') || [];
            if (!achievements.includes(achievementId)) {
                achievements.push(achievementId);
                wx.setStorageSync('superjog_achievements', achievements);
            }
        } catch (error) {
            console.error('保存成就失败:', error);
        }
    },

    // 设置随机文本
    setRandomTexts: function () {
        const encouragementIndex = Math.floor(Math.random() * this.data.encouragementMessages.length);
        const tipIndex = Math.floor(Math.random() * this.data.healthTips.length);

        this.setData({
            encouragementMessage: this.data.encouragementMessages[encouragementIndex],
            healthTip: this.data.healthTips[tipIndex]
        });
    },

    // 分享结果触发的震动反馈
    shareResult: function () {
        wx.vibrateShort({
            type: 'light'
        });
        // 分享功能现在通过wxml中按钮的open-type="share"属性实现
        // 实际的分享内容在onShareAppMessage函数中定义
    },

    // 继续锻炼
    backToMain: function () {
        wx.vibrateShort({
            type: 'light'
        });

        // 返回前一页
        wx.navigateBack({
            delta: 1 // 返回上一级页面
        });
    },

    // 返回首页
    backToHome: function () {
        wx.vibrateShort({
            type: 'light'
        });

        wx.reLaunch({
            url: '/pages/index/index'
        });
    },

    // 格式化日期
    formatDate: function (date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // 自定义分享
    onShareAppMessage: function () {
        const { actualDuration, isCompleted } = this.data;
        let title = `我今天完成了${actualDuration}分钟的超慢跑锻炼！`;
        if (!isCompleted) {
            title = `我今天进行了${actualDuration}分钟的超慢跑锻炼！`;
        }

        return {
            title: title,
            path: '/pages/superjog/superjog',
            imageUrl: '/images/superjog-share.jpg' // 需要添加分享图片
        };
    },

    // 分享到朋友圈
    onShareTimeline: function () {
        const { actualDuration, totalMinutes, totalDays } = this.data;
        return {
            title: `我已累计完成${totalMinutes}分钟超慢跑锻炼，连续运动${totalDays}天！`,
            imageUrl: '/images/superjog-timeline.jpg' // 需要添加朋友圈分享图片
        };
    }
}); 