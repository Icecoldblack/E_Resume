import React from 'react';
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
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = async (response: CredentialResponse) => {
    if (response.credential) {
      try {
        const decoded: any = jwtDecode(response.credential);
        
        // Check if user has completed onboarding by fetching from backend
        let onboardingCompleted = false;
        try {
          const profileResponse = await fetch(
            `${API_BASE_URL}/api/extension/profile?email=${encodeURIComponent(decoded.email)}`
          );
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            onboardingCompleted = profile.onboardingCompleted === true;
          }
        } catch (err) {
          console.log('Could not fetch profile, will check onboarding');
        }
        
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
  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop',

  'https://mamstartup.pl/assets/576/384/86123/86123.jpeg',

  'https://mamstartup.pl/assets/576/384/86123/86123.jpeg',

  'https://cloudfront-us-east-2.images.arcpublishing.com/reuters/ML434ZX7U5LBHCU4WN5K3W7BZQ.jpg',

  'https://nintendosoup.com/wp-content/uploads/2024/06/Nintendo-HQ-Red-1038x576.jpg',

  'https://helios-i.mashable.com/imagery/articles/025DOuFcnh7IGdQC0EYie0I/images-4.fill.size_800x599.v1675105689.jpg',
  
  'https://images.unsplash.com/photo-1508780709619-79562169bc64?q=80&w=3870&auto=format&fit=crop',

  'https://images.unsplash.com/photo-1537432376769-00a63d6c07f2?q=80&w=3870&auto=format&fit=crop',
 
  'https://thebrandhopper.com/wp-content/uploads/2023/03/jp-morgan-chase-title-1024x553.jpg',
 
  'https://images.tech.co/wp-content/uploads/2022/03/31082824/AdobeStock_303541183_Editorial_Use_Only-min-708x400.jpeg',

  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop',

  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop',

  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop',

  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop',

  'https://mamstartup.pl/assets/576/384/86123/86123.jpeg',

  'https://mamstartup.pl/assets/576/384/86123/86123.jpeg',

  'https://cloudfront-us-east-2.images.arcpublishing.com/reuters/ML434ZX7U5LBHCU4WN5K3W7BZQ.jpg',

  'https://nintendosoup.com/wp-content/uploads/2024/06/Nintendo-HQ-Red-1038x576.jpg',

  'https://helios-i.mashable.com/imagery/articles/025DOuFcnh7IGdQC0EYie0I/images-4.fill.size_800x599.v1675105689.jpg',
  
  'https://images.unsplash.com/photo-1508780709619-79562169bc64?q=80&w=3870&auto=format&fit=crop',

  'https://images.unsplash.com/photo-1537432376769-00a63d6c07f2?q=80&w=3870&auto=format&fit=crop',
 
  'https://thebrandhopper.com/wp-content/uploads/2023/03/jp-morgan-chase-title-1024x553.jpg',
 
  'https://images.tech.co/wp-content/uploads/2022/03/31082824/AdobeStock_303541183_Editorial_Use_Only-min-708x400.jpeg',

  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop',

  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop',

  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop',

  'https://images.unsplash.com/photo-1537432376769-00a63d6c07f2?q=80&w=3870&auto=format&fit=crop',
 

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
          <p><b>Use your Google account to continue.</b></p>

          <div className="google-login-container">
            <GoogleLogin onSuccess={handleSuccess} onError={handleError} />
          </div>

          <p className="login-footer-text"><b>Secure sign-in powered by Google OAuth.</b></p>
        </div>
      </div>

      <p style={{
        textAlign: "center",
        color: "#6e6e6eff",
        position: "fixed",
        bottom: "0px",
        fontFamily: "'Gill Sans', sans-serif"
      }}>
        <i>By Two Minorities</i>
      </p>
    </>
  );
};

export default HomePage;
