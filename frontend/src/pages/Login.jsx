import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { motion } from 'framer-motion';

const Login = () => {
  const navigate = useNavigate();
  const { login, googleLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-purple-600/10 rounded-full blur-[80px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-[440px] px-6"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
             <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white font-display tracking-tight">Welcome to DeskTrack</h1>
          <p className="text-slate-400 mt-2 font-medium">The ultimate workforce management suite</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl shadow-2xl p-8 border-t border-t-white/10">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3 bg-alert-500/10 border border-alert-500/20 rounded-xl text-alert-500 text-sm font-bold text-center"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-5">
            {/* Google Sign-In */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sign in with your organization account</p>
              <div className="w-full flex justify-center" style={{ colorScheme: 'normal' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="filled_blue"
                  size="large"
                  width="380"
                  text="signin_with"
                  shape="rectangular"
                  logo_alignment="left"
                />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Only authorized domains can access DeskTrack
              </p>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-slate-600 uppercase tracking-widest">or email</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <Input 
                icon={Mail}
                type="email"
                placeholder="Work Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600"
              />
              <Input 
                icon={Lock}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600"
              />
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-primary-600 hover:bg-primary-500 text-white font-bold gap-2 shadow-[0_4px_15px_rgba(37,99,235,0.3)] group"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-slate-500 text-xs font-medium">
              By signing in, you agree to our <a href="#" className="text-primary-500 hover:underline">Terms</a> and <a href="#" className="text-primary-500 hover:underline">Privacy Policy</a>
            </p>
          </div>
        </Card>
        
        <div className="mt-8 text-center text-slate-600 text-sm font-medium">
          New to DeskTrack? <a href="#" className="text-primary-500 font-bold hover:underline">Contact Sales</a>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
