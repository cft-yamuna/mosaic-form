import { useState, useRef, useEffect } from 'react';
import { Camera, Upload } from 'lucide-react';
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
  const [showCaptureOptions, setShowCaptureOptions] = useState(false);
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

  useEffect(() => {
    if (step === 'capture') {
      setShowCaptureOptions(true);
    }
    return () => {
      stopCamera();
    };
  }, [step]);

  useEffect(() => {
    if (step === 'thankyou') {
      const timer = setTimeout(() => {
        setCapturedImage(null);
        setRandomMessage('');
        setStep('capture');
      }, 500000);

      return () => clearTimeout(timer);
    }
  }, [step]);

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

  const handleCaptureOption = (option: 'photo' | 'gallery') => {
    setShowCaptureOptions(false);
    if (option === 'photo') {
      startCamera();
    } else if (option === 'gallery' && fileInputRef.current) {
      fileInputRef.current.click();
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
    const payload = { event: 'imagesent', data: { userId } };
    console.log('Socket emitting payload:', payload);
    console.log('Socket sending user id:', userId);
  };

  return (
    <>
      <div
        className="min-h-screen bg-black flex flex-col items-center justify-start pt-8 px-4 relative overflow-hidden"
        style={{
          backgroundImage: step === 'thankyou' ? 'url(/final.png)' : 'url(/start.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >

        <div className="relative z-10 w-full max-w-md">
          <div className={`flex items-center justify-center mb-20 ${step === 'thankyou' ? 'mt-16' : ''}`}>
            <img src="/logo.png" alt="SBER 15 Banking in India" className="h-12 object-contain mx-auto" />
          </div>

        {step === 'capture' && (
          <>
            <h2 className="text-white text-3xl  mb-6 text-center">Snap a quick selfie</h2>

            <div className="relative bg-white  overflow-hidden mb-6" style={{ aspectRatio: '3/4' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
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

            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={capturePhoto}
                className="w-1/2 bg-black text-white text-xl font-bold py-4 px-4 rounded-xl hover:bg-white hover:text-black transition-colors"
              >
                Capture
              </button>
            </div>
          </>
        )}

        {step === 'preview' && capturedImage && (
          <>
            <div className="relative bg-white  overflow-hidden mb-6" style={{ aspectRatio: '3/4' }}>
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
                className="flex-1 bg-black text-white text-xl font-bold py-4 px-8 rounded-xl hover:bg-white hover:text-black transition-colors disabled:opacity-50"
              >
                Retake
              </button>
              <button
                onClick={submitPhoto}
                disabled={isSubmitting}
                className="flex-1 bg-black text-white text-xl font-bold py-4 px-8 rounded-xl hover:bg-white hover:text-black transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {step === 'thankyou' && (
          <div className="flex items-center justify-center min-h-[60vh] px-8">
            {randomMessage && (
              <div className="text-center p-6 bg-[#005950]/30 backdrop-blur-sm rounded-3xl border border-white/20">
                <p className="text-4xl font-semibold mb-8" style={{ color: '#FFC300' }}>{randomMessage}</p>
                 <p className="text-white text-md leading-relaxed">
              Check the LED screen
              to see <br /> your image in
              the mosaic.
            </p>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      {showCaptureOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-black rounded-2xl w-full max-w-sm text-center shadow-2xl border border-white/20 overflow-hidden">
            <button
              onClick={() => handleCaptureOption('photo')}
              className="w-full text-white text-lg font-medium py-5 hover:bg-white/10 transition-colors flex items-center justify-center gap-3"
            >
              <Camera className="w-6 h-6" />
              Capture your Image
            </button>
            <div className="border-t border-white/20">
              <button
                onClick={() => handleCaptureOption('gallery')}
                className="w-full text-white text-lg font-medium py-5 hover:bg-white/10 transition-colors flex items-center justify-center gap-3"
              >
                <Upload className="w-6 h-6" />
                Upload from Gallery
              </button>
            </div>
            {/* <div className="border-t border-white/20">
              <button
                onClick={() => setShowCaptureOptions(false)}
                className="w-full text-white text-base font-medium py-5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div> */}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
