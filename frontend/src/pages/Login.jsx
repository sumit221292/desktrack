import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';

const FeatureItem = ({ icon: Icon, title, description, delay }) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="flex items-center space-x-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all duration-300"
  >
    <div className="p-2.5 rounded-xl bg-primary-600/20 text-primary-400 group-hover:scale-110 transition-transform">
      <Icon size={20} />
    </div>
    <div className="text-left">
      <h3 className="text-sm font-bold text-white leading-tight">{title}</h3>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
  </motion.div>
);

const Login = () => {
  const navigate = useNavigate();
  const { googleLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hasGoogleId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setError('');
    try {
      await googleLogin(credentialResponse.credential);
      navigate('/');
    } catch (err) {
      const errorMessage = err?.response?.data?.message 
        || err?.response?.data?.error 
        || 'Google Sign-In failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In was cancelled or failed. Please try again.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#020617]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary-600/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
            rotate: [360, 0, 360]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[150px]" 
        />
      </div>

      <div className="relative z-10 w-full max-w-[1000px] flex flex-col md:flex-row items-center gap-12 px-6">
        {/* Left Side: Branding and Features */}
        <div className="flex-1 text-center md:text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary-600 mb-8 shadow-[0_0_30px_rgba(37,99,235,0.4)]"
          >
            <ShieldCheck size={40} className="text-white" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-extrabold text-white font-display tracking-tight leading-[1.1] mb-4"
          >
            Secure access to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-indigo-400">DeskTrack</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-400 font-medium mb-12 max-w-md"
          >
            Sign in with your corporate account to access real-time workforce insights and performance analytics.
          </motion.p>
          
          <div className="grid grid-cols-1 gap-4 max-w-lg">
            <FeatureItem 
              icon={TrendingUp} 
              title="Live Performance" 
              description="Real-time KPI tracking and dynamic analytics."
              delay={0.2}
            />
            <FeatureItem 
              icon={Clock} 
              title="Smart Attendance" 
              description="Automated check-ins and shift management."
              delay={0.3}
            />
            <FeatureItem 
              icon={Zap} 
              title="Global SaaS Core" 
              description="Multi-tenant secure data isolation."
              delay={0.4}
            />
          </div>
        </div>

        {/* Right Side: Login Card */}
        <motion.div 
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-[420px]"
        >
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-10 rounded-3xl relative overflow-hidden text-center">
            {/* Top Shine */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <h2 className="text-xl font-bold text-white mb-2">Corporate Login</h2>
            <p className="text-sm text-slate-500 mb-10">Select your account to continue</p>
            
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold overflow-hidden"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col items-center gap-6">
              <div className="w-full flex flex-col items-center justify-center min-h-[50px]">
                {hasGoogleId ? (
                  <div className="relative group w-full flex justify-center transform transition-transform duration-300 hover:scale-[1.02]">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000" />
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      theme="filled_blue"
                      size="large"
                      width="340"
                      text="continue_with"
                      shape="pill"
                    />
                  </div>
                ) : (
                  <div className="text-center p-6 bg-slate-800/50 border border-slate-700/50 rounded-2xl w-full">
                    <CheckCircle2 size={32} className="text-primary-500 mx-auto mb-3" />
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      Authentication system is being initialized. Please set <code className="text-primary-400 px-1">VITE_GOOGLE_CLIENT_ID</code> in your Railway dashboard.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4 w-full">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Security Guaranteed</p>
                <div className="flex items-center justify-center space-x-6">
                  {['SSO', 'OAuth 2.0', 'AES-256'].map((tech) => (
                    <span key={tech} className="text-[11px] font-bold text-slate-400/50 px-2 py-1 border border-white/5 rounded-md">{tech}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5">
              <p className="text-slate-500 text-xs font-medium">
                Protected by <span className="text-primary-400">DeskTrack Security Cloud</span>
              </p>
              <div className="flex justify-center space-x-4 mt-2">
                <a href="#" className="text-slate-600 hover:text-primary-400 text-[10px] transition-colors">Privacy</a>
                <a href="#" className="text-slate-600 hover:text-primary-400 text-[10px] transition-colors">Security Docs</a>
              </div>
            </div>
          </Card>
          
          <motion.button 
            whileHover={{ x: 5 }}
            className="mt-8 flex items-center space-x-2 text-slate-500 hover:text-white transition-colors mx-auto text-sm font-medium"
          >
            <span>Need enterprise support?</span>
            <ArrowRight size={16} />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
