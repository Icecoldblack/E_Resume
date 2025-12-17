import React, { useEffect } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';
import SplitText from "../../context/SplitText";
import StarBorder from "../../context/StarBorder";
import Aurora from '../../context/Aurora';
import GridMotion from '../../context/GridMotion';
import './HomePage.css';

const HomePage: React.FC = () => {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated - runs before render
  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        if (user.onboardingCompleted) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Don't render login page if already authenticated - prevents flash
  if (isAuthenticated && user && localStorage.getItem('auth_token')) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0d1420'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(88, 166, 255, 0.2)',
          borderTopColor: '#58a6ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const handleSuccess = async (response: CredentialResponse) => {
    if (response.credential) {
      try {
        const decoded: any = jwtDecode(response.credential);

        // Check if user has completed onboarding by fetching from backend
        let onboardingCompleted = false;
        try {
          const profileResponse = await fetch(
            `${API_BASE_URL}/api/extension/profile?email=${encodeURIComponent(decoded.email)}`,
            {
              headers: {
                'Authorization': `Bearer ${response.credential}`
              }
            }
          );
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            onboardingCompleted = profile.onboardingCompleted === true;
          }
        } catch (err) {
          console.log('Could not fetch profile, will check onboarding');
        }

        // Save the raw token for API requests
        localStorage.setItem('auth_token', response.credential);

        login({
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
          googleId: decoded.sub,
          onboardingCompleted: onboardingCompleted
        });

        // Navigate based on onboarding status
        if (onboardingCompleted) {
          navigate('/dashboard');
        } else {
          navigate('/onboarding');
        }
      } catch (error) {
        console.error('Failed to decode token', error);
      }
    }
  };

  const handleError = () => {
    console.error('Login Failed');
  };

  const handleAnimationComplete = () => {
    console.log('All letters have animated!');
  };

  const items = [
    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Flive.staticflickr.com%2F5102%2F5636235907_63afd02b5e.jpg&f=1&nofb=1&ipt=79c4ce54c20a7cfa094d16fedd1dcef1d87c0220bbe3852fdda546de0820e535',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Flive.staticflickr.com%2F5102%2F5636235907_63afd02b5e.jpg&f=1&nofb=1&ipt=79c4ce54c20a7cfa094d16fedd1dcef1d87c0220bbe3852fdda546de0820e535',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse2.mm.bing.net%2Fth%2Fid%2FOIP.MZx3lUq7InbdTaHZWZQx3wAAAA%3Fcb%3Ducfimg2%26pid%3DApi%26ucfimg%3D1&f=1&ipt=e334b47a8ee5daa9166a0095a0465c27d4f7d9a1cd47d0e76c0eafb21cd0381d&ipo=images',

    'https://cloudfront-us-east-2.images.arcpublishing.com/reuters/ML434ZX7U5LBHCU4WN5K3W7BZQ.jpg',

    'https://nintendosoup.com/wp-content/uploads/2024/06/Nintendo-HQ-Red-1038x576.jpg',

    'https://helios-i.mashable.com/imagery/articles/025DOuFcnh7IGdQC0EYie0I/images-4.fill.size_800x599.v1675105689.jpg',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fc2.staticflickr.com%2F8%2F7013%2F6806682041_2e445d866d_b.jpg&f=1&nofb=1&ipt=5ab9e1a981a20096beb97fd0fe5f90141de4ac1cfcd24da3155b3876b37a20f2',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse2.mm.bing.net%2Fth%2Fid%2FOIP.1bozjQskInOJke1IXhx5eQHaFD%3Fcb%3Ducfimg2%26pid%3DApi%26ucfimg%3D1&f=1&ipt=b48e0c7d5bd9a688da7b232c229b781b04169af9f84eaa5bb7e7694a22ca54eb&ipo=images',

    'https://thebrandhopper.com/wp-content/uploads/2023/03/jp-morgan-chase-title-1024x553.jpg',

    'https://images.tech.co/wp-content/uploads/2022/03/31082824/AdobeStock_303541183_Editorial_Use_Only-min-708x400.jpeg',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse2.mm.bing.net%2Fth%2Fid%2FOIP.RsWq7KKmMw-4EDP2VsfEIAHaE8%3Fcb%3Ducfimg2%26pid%3DApi%26ucfimg%3D1&f=1&ipt=9f3fc2e9398dfcdd98247abf95ca5bd56b3d69b41c7b5359a915069fc1bb7812&ipo=images',

    'https://akns-images.eonline.com/eol_images/Entire_Site/2019812/rs_1024x565-190912181032-634-tyler-perry-studios.jpg?fit=around%7C1024:565&output-quality=90&crop=1024:565;center,top',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse3.mm.bing.net%2Fth%2Fid%2FOIP.BlADT-Sh_y1OdV2KLvSmSAHaE8%3Fcb%3Ducfimg2%26pid%3DApi%26ucfimg%3D1&f=1&ipt=dc2cf8fd1f8cea262bdd57f2d423bfa203cee81bb32a37bd76d3e0845ab9b96c&ipo=images',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse1.mm.bing.net%2Fth%2Fid%2FOIP.IImRs0Fj7Y1ZYkGc_IA9BwHaE8%3Fcb%3Ducfimg2%26pid%3DApi%26ucfimg%3D1&f=1&ipt=22a1b357a730a1cce67523cc04081ae558b8bdf18ae45976623a2eb7857c772c&ipo=images',

    'https://mamstartup.pl/assets/576/384/86123/86123.jpeg',

    'https://res.cloudinary.com/aenetworks/image/upload/c_fill,ar_2,w_1080,h_540,g_auto/dpr_auto/f_auto/q_auto:eco/v1/legislative-branch-gettyimages-936281826?_a=BAVAZGID0',

    'https://cloudfront-us-east-2.images.arcpublishing.com/reuters/ML434ZX7U5LBHCU4WN5K3W7BZQ.jpg',

    'https://nintendosoup.com/wp-content/uploads/2024/06/Nintendo-HQ-Red-1038x576.jpg',

    'https://helios-i.mashable.com/imagery/articles/025DOuFcnh7IGdQC0EYie0I/images-4.fill.size_800x599.v1675105689.jpg',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fc2.staticflickr.com%2F8%2F7013%2F6806682041_2e445d866d_b.jpg&f=1&nofb=1&ipt=5ab9e1a981a20096beb97fd0fe5f90141de4ac1cfcd24da3155b3876b37a20f2',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fmedia.istockphoto.com%2Fid%2F1627138218%2Fphoto%2Fea-office-building-in-austin-texas-usa.jpg%3Fs%3D612x612%26w%3D0%26k%3D20%26c%3Dte98_Vu3Zc-BcxZ5OIJty3B9lkSyNvbeH754YDDFKxs%3D&f=1&nofb=1&ipt=d8fc9fc87929fbc8394e468a52ef2e53d7541b576aafb455a43ba2520d55b47c',

    'https://thebrandhopper.com/wp-content/uploads/2023/03/jp-morgan-chase-title-1024x553.jpg',

    'https://images.tech.co/wp-content/uploads/2022/03/31082824/AdobeStock_303541183_Editorial_Use_Only-min-708x400.jpeg',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse4.mm.bing.net%2Fth%2Fid%2FOIP.cbpo3iISu-pbqLGUnRM0YQHaEK%3Fcb%3Ducfimg2%26pid%3DApi%26ucfimg%3D1&f=1&ipt=6ee2085c45f8140484d5dd48d65884691ce66073c3b3b287aea50a2dec8b49de&ipo=images',

    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fcdn.prod.website-files.com%2F61702af2e3966e09c4101538%2F677de278db1a0dcc0de40e84_69202e6c-3ac3-49fe-815f-c22aa654d923.jpeg&f=1&nofb=1&ipt=ef4f44300207efd18c242739dc04d57c1e2b130ae7e41239f8bf65865afb3b09',

    'https://static0.simpleflyingimages.com/wordpress/wp-content/uploads/2024/10/52684534_2419660888053079_7685507066072399872_n.jpg?q=49&fit=crop&w=825&dpr=2',

    'https://parameter.io/wp-content/uploads/2025/08/Tesla-1-1168x933-1-1002x800.webp',


  ];



  return (
    <>
      <div className="login-page">

        {/* Background layer */}
        <div className="grid-background">
          <GridMotion items={items} />
        </div>

        {/* Foreground content */}
        <div className="login-card">
          <SplitText
            text="Easepath"
            className="login-logo"
            delay={100}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.1}
            tag="h2"
            rootMargin="-100px"
            textAlign="center"
            onLetterAnimationComplete={handleAnimationComplete}
          />
          <h2>Welcome</h2>
          <p><b>The Easier way to apply and win</b></p>

          <div className="google-login-container">
            <GoogleLogin onSuccess={handleSuccess} onError={handleError} />
          </div>

          <p className="login-footer-text"><b>Time to Get Started.</b></p>
        </div>
      </div>
    </>
  );
};

export default HomePage;
