const fs = require('fs');
const { Readable } = require('stream');

// 基本参数
const SAMPLE_RATE = 44100; // 采样率
const BIT_DEPTH = 16; // 位深度
const CHANNELS = 1; // 单声道

// 生成 WAV 文件头
function createWavHeader(dataLength, channels, sampleRate, bitDepth) {
    const buffer = Buffer.alloc(44);

    // RIFF 头
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(dataLength + 36, 4); // 文件长度 - 8
    buffer.write('WAVE', 8);

    // fmt 块
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // 块大小
    buffer.writeUInt16LE(1, 20); // 音频格式 (PCM)
    buffer.writeUInt16LE(channels, 22); // 通道数
    buffer.writeUInt32LE(sampleRate, 24); // 采样率
    buffer.writeUInt32LE(sampleRate * channels * bitDepth / 8, 28); // 字节率
    buffer.writeUInt16LE(channels * bitDepth / 8, 32); // 块对齐
    buffer.writeUInt16LE(bitDepth, 34); // 每个样本的比特数

    // data 块
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40); // 数据大小

    return buffer;
}

// 生成声音文件
function generateSoundFile(filename, duration, volume, frequency, decayRate, waveform = 'sine') {
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const dataLength = numSamples * CHANNELS * BIT_DEPTH / 8;

    const header = createWavHeader(dataLength, CHANNELS, SAMPLE_RATE, BIT_DEPTH);
    const data = Buffer.alloc(dataLength);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE; // 时间
        let sampleValue = 0;

        // 指数衰减
        const decay = Math.exp(-decayRate * t);

        if (waveform === 'sine') {
            sampleValue = Math.sin(2 * Math.PI * frequency * t) * decay * volume;
        } else if (waveform === 'square') {
            sampleValue = (Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1) * decay * volume;
        } else if (waveform === 'sawtooth') {
            sampleValue = (2 * (t * frequency - Math.floor(0.5 + t * frequency))) * decay * volume;
        } else if (waveform === 'noise') {
            sampleValue = (Math.random() * 2 - 1) * decay * volume;
        }


        // 转换到16位整数并写入缓冲区
        const value = Math.floor(sampleValue * 32767);
        const offset = i * (BIT_DEPTH / 8);
        data.writeInt16LE(value, offset);
    }

    // 合并头部和数据
    const wavBuffer = Buffer.concat([header, data]);

    // 确保 sounds 目录存在
    if (!fs.existsSync('sounds')) {
        fs.mkdirSync('sounds');
    }

    // 写入文件
    fs.writeFileSync(`sounds/${filename}.wav`, wavBuffer);
    console.log(`声音文件已生成：sounds/${filename}.wav`);
}

// 定义不同音效的参数
const soundEffects = [
    { name: 'move', duration: 0.05, volume: 0.6, frequency: 800, decay: 25, waveform: 'sine' },
    { name: 'rotate', duration: 0.07, volume: 0.7, frequency: 1000, decay: 22, waveform: 'sine' }, // Changed waveform, frequency, duration, decay
    { name: 'drop', duration: 0.08, volume: 0.8, frequency: 700, decay: 18, waveform: 'sine' }, // Changed for harmony
    { name: 'clear', duration: 0.3, volume: 0.9, frequency: 1500, decay: 10, waveform: 'sine' }, // 清除行音效长一些
    { name: 'game_over', duration: 0.3, volume: 0.9, frequency: 150, decay: 3, waveform: 'sine' }, // Reduced duration by half
    { name: 'level_up', duration: 0.25, volume: 0.9, frequency: 1800, decay: 8, waveform: 'square' }, // Reduced duration by half
    { name: 'high_score', duration: 0.3, volume: 1.0, frequency: 2000, decay: 7, waveform: 'sine' } // Reduced duration to shrink file size
];

// 生成所有音效文件
soundEffects.forEach(effect => {
    generateSoundFile(effect.name, effect.duration, effect.volume, effect.frequency, effect.decay, effect.waveform);
});

// 原来的 tick.wav 生成（如果还需要）
// generateSoundFile('tick', 0.05, 0.8, 1000, 15, 'sine');