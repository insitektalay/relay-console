// VoiceInputViewModel.swift
// ClawChat - native speech transcription for the message composer.

import AVFoundation
import Foundation
import Observation
import Speech

@MainActor
@Observable
final class VoiceInputViewModel {
    var isRecording = false
    var transcript = ""
    var errorMessage: String?

    private let audioEngine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    func toggleRecording() async -> String? {
        if isRecording {
            return stopRecording()
        }

        do {
            try await startRecording()
        } catch {
            errorMessage = (error as? VoiceInputError)?.errorDescription ?? error.localizedDescription
        }
        return nil
    }

    func cancelRecording() {
        recognitionTask?.cancel()
        stopAudioEngine()
        transcript = ""
        isRecording = false
    }

    private func startRecording() async throws {
        errorMessage = nil
        transcript = ""

        guard recognizer?.isAvailable == true else {
            throw VoiceInputError.recognizerUnavailable
        }

        try await requestPermissions()

        recognitionTask?.cancel()
        recognitionTask = nil

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer?.supportsOnDeviceRecognition == true {
            request.requiresOnDeviceRecognition = true
        }
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak request] buffer, _ in
            request?.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
        isRecording = true

        recognitionTask = recognizer?.recognitionTask(with: request) { [weak self] result, error in
            _Concurrency.Task { @MainActor [weak self] in
                guard let self else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                if let error {
                    self.errorMessage = error.localizedDescription
                    self.stopAudioEngine()
                    self.isRecording = false
                }
                if result?.isFinal == true {
                    self.stopAudioEngine()
                    self.isRecording = false
                }
            }
        }
    }

    private func stopRecording() -> String? {
        recognitionRequest?.endAudio()
        recognitionTask?.finish()
        stopAudioEngine()
        isRecording = false

        let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func stopAudioEngine() {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func requestPermissions() async throws {
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
        guard speechStatus == .authorized else {
            throw VoiceInputError.speechPermissionDenied
        }

        let granted = await AVAudioApplication.requestRecordPermission()
        guard granted else {
            throw VoiceInputError.microphonePermissionDenied
        }
    }
}

private enum VoiceInputError: LocalizedError {
    case recognizerUnavailable
    case speechPermissionDenied
    case microphonePermissionDenied

    var errorDescription: String? {
        switch self {
        case .recognizerUnavailable:
            return "Speech recognition is unavailable right now."
        case .speechPermissionDenied:
            return "Speech recognition permission is required for voice input."
        case .microphonePermissionDenied:
            return "Microphone permission is required for voice input."
        }
    }
}
