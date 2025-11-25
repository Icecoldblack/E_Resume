import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from '../../context/AuthContext';
import SplitText from "../../context/SplitText";
import StarBorder from "../../context/StarBorder";
import Aurora from '../../context/Aurora';
import GridMotion from '../../context/GridMotion';
import './HomePage.css';

const HomePage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = (response: CredentialResponse) => {
    if (response.credential) {
      try {
        const decoded: any = jwtDecode(response.credential);
        login({
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture
        });
        navigate('/dashboard');
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
  'Item 1',
  <div key='jsx-item-1'>Custom JSX Content</div>,
  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop',
  
  'Item 2',
  <div key='jsx-item-2'>Custom JSX Content</div>,
  'https://mamstartup.pl/assets/576/384/86123/86123.jpeg',

   'Item 3',
  <div key='jsx-item-3'>Custom JSX Content</div>,
  'https://mamstartup.pl/assets/576/384/86123/86123.jpeg',
  

  'Item 5',
  <div key='jsx-item-5'>Custom JSX Content</div>,
  'https://cloudfront-us-east-2.images.arcpublishing.com/reuters/ML434ZX7U5LBHCU4WN5K3W7BZQ.jpg',

  'Item 6',
  <div key='jsx-item-6'>Custom JSX Content</div>,
  'https://nintendosoup.com/wp-content/uploads/2024/06/Nintendo-HQ-Red-1038x576.jpg',
  
  'Item 7',
  <div key='jsx-item-7'>Space-X</div>,
  'https://helios-i.mashable.com/imagery/articles/025DOuFcnh7IGdQC0EYie0I/images-4.fill.size_800x599.v1675105689.jpg',
  
  'Item 8',
  <div key='jsx-item-8'>Custom JSX Content</div>,
  'https://images.unsplash.com/photo-1508780709619-79562169bc64?q=80&w=3870&auto=format&fit=crop',
  
  'Item 9',
  <div key='jsx-item-9'>Custom JSX Content</div>,
  'https://images.unsplash.com/photo-1537432376769-00a63d6c07f2?q=80&w=3870&auto=format&fit=crop',
  
  'Item 10',
  <div key='jsx-item-10'>Custom JSX Content</div>,
  'https://thebrandhopper.com/wp-content/uploads/2023/03/jp-morgan-chase-title-1024x553.jpg',
  
  'Item 11',
  <div key='jsx-item-11'>Microsoft</div>,
  'https://images.tech.co/wp-content/uploads/2022/03/31082824/AdobeStock_303541183_Editorial_Use_Only-min-708x400.jpeg',

  'Item 12',
  <div key='jsx-item-12'>Microsoft</div>,
  'https://images.tech.co/wp-content/uploads/2022/03/31082824/AdobeStock_303541183_Editorial_Use_Only-min-708x400.jpeg',

  'Item 13',
  <div key='jsx-item-13'>Microsoft</div>,
  'https://images.tech.co/wp-content/uploads/2022/03/31082824/AdobeStock_303541183_Editorial_Use_Only-min-708x400.jpeg',

  'Item 14',
  <div key='jsx-item-14'>Microsoft</div>,
  'https://images.tech.co/wp-content/uploads/2022/03/31082824/AdobeStock_303541183_Editorial_Use_Only-min-708x400.jpeg',

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
