import { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from './lib/supabase';

const MESSAGES = [
  'You make SBER shine brighter!',
  'The camera loves you!',
  'That smile says success!',
  'Total SBER star energy!',
  'You just lit up the screen!',
  'Your energy defines success!',
  'SBER grows stronger with you!',
  'You inspire excellence every day!',
  "You're a true part of SBER's story!",
  'Your presence means a lot to us!',
];

const generateUserId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

function App() {
  const [step, setStep] = useState<'capture' | 'preview' | 'thankyou'>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [randomMessage, setRandomMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const BUCKET_NAME = 'mosaic';
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageData);
        setStep('preview');
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
        setStep('preview');
      };
      reader.readAsDataURL(file);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setStep('capture');
    startCamera();
  };

  const submitPhoto = async () => {
    if (!capturedImage) return;

    setIsSubmitting(true);
    try {
      const getFileName = () =>
        `selfies/${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}.jpg`;
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const fileExt = blob.type.split('/')[1] ?? 'jpg';
      const fileName = getFileName().replace('.jpg', `.${fileExt}`);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: blob.type || 'image/jpeg',
        });

      if (uploadError || !uploadData?.path) {
        throw uploadError ?? new Error('Failed to upload image');
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to obtain a public URL for the uploaded image');
      }

      const imageUrl = publicUrlData.publicUrl;

      const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      setRandomMessage(message);
      const userId = generateUserId();

      const { data, error } = await supabase
        .from('user_selfies')
        .insert([
          {
            user_id: userId,
            user_message: message,
            image_url: imageUrl,
          },
        ])
        .select()
        .maybeSingle();

      if (error) throw error;

      if (data) {
        emitSocket(userId);
      }

      setStep('thankyou');
    } catch (error) {
      console.error('Error submitting photo:', error);
      alert('Failed to submit photo. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const emitSocket = (userId: string) => {
    console.log('Socket emit: imagesent', { userId });
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-start pt-8 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 via-transparent to-blue-500/20 pointer-events-none"></div>
      <div className="absolute top-20 left-10 w-64 h-64 bg-teal-400/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-cyan-400/20 rounded-full blur-3xl"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <Camera className="w-6 h-6 text-black" />
          </div>
          <div>
            <span className="text-white font-bold text-2xl">SBER</span>
            <span className="text-white text-sm ml-2">15 banking in India</span>
          </div>
        </div>

        {step === 'capture' && (
          <>
            <h2 className="text-white text-3xl font-bold mb-6">Snap a quick selfie</h2>

            <div className="relative bg-white rounded-lg overflow-hidden mb-6" style={{ aspectRatio: '9/16' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                onLoadedMetadata={startCamera}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              onClick={() => {
                if (videoRef.current && videoRef.current.srcObject) {
                  capturePhoto();
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className="w-full bg-black text-white text-xl font-semibold py-4 px-8 rounded-full border-2 border-white hover:bg-white hover:text-black transition-colors"
            >
              Capture
            </button>
          </>
        )}

        {step === 'preview' && capturedImage && (
          <>
            <div className="relative bg-white rounded-lg overflow-hidden mb-6" style={{ aspectRatio: '9/16' }}>
              <img
                src={capturedImage}
                alt="Captured selfie"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={retake}
                disabled={isSubmitting}
                className="flex-1 bg-black text-white text-xl font-semibold py-4 px-8 rounded-full border-2 border-white hover:bg-white hover:text-black transition-colors disabled:opacity-50"
              >
                Retake
              </button>
              <button
                onClick={submitPhoto}
                disabled={isSubmitting}
                className="flex-1 bg-black text-white text-xl font-semibold py-4 px-8 rounded-full border-2 border-white hover:bg-white hover:text-black transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {step === 'thankyou' && (
          <div className="text-center">
            <h2 className="text-white text-5xl font-bold mb-8">You look great!</h2>
            <p className="text-white text-xl leading-relaxed">
              Check the LED screen<br />
              to see your image in<br />
              the mosaic.
            </p>
            {randomMessage && (
              <div className="mt-12 p-6 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                <p className="text-teal-300 text-2xl font-semibold">{randomMessage}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
