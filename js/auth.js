const API_BASE = 'https://abb-backend.onrender.com';
const JWT_KEY  = 'aab_token';
const USER_KEY = 'aab_currentUser';
const DEFAULT_INVITE_CODE = '2233';

// Helper to store session
function setSession(token,user){
  sessionStorage.setItem(JWT_KEY,token);
  sessionStorage.setItem(USER_KEY,JSON.stringify(user));
}

// SIGNUP
const signupForm = document.getElementById('signup-form');
if(signupForm){
  signupForm.addEventListener('submit',async (e)=>{
    e.preventDefault();
    const name       = signupForm['signup-name'].value.trim();
    const email      = signupForm['signup-email'].value.trim();
    const phone      = signupForm['signup-phone'].value.trim();
    const password   = signupForm['signup-password'].value;
    const confirm    = signupForm['signup-confirm'].value;
    const inviteCode = signupForm['signup-invite'].value.trim() || DEFAULT_INVITE_CODE;
    if(password!==confirm) return alert('Passwords do not match');
    try{
      const res = await fetch(API_BASE+'/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name,email,password,phone,inviteCode})});
      const data = await res.json();
      if(!res.ok) throw new Error(data.message);
      setSession(data.token,data.user);
      location.href='index.html';
    }catch(err){ alert(err.message||'Signup failed'); }
  });
}

// LOGIN
const loginForm = document.getElementById('login-form');
if(loginForm){
  loginForm.addEventListener('submit',async (e)=>{
    e.preventDefault();
    const email = loginForm['login-email'].value.trim();
    const password = loginForm['login-password'].value;
    const isAdmin = document.getElementById('login-admin')?.checked;
    if(isAdmin){
      if(email==='admin@aab.com' && password==='admin123'){
        sessionStorage.setItem('aab_currentAdmin',JSON.stringify({email}));
        return location.href='admin.html';
      }
      return alert('Invalid admin credentials');
    }
    try{
      const res = await fetch(API_BASE+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const data = await res.json();
      if(!res.ok) throw new Error(data.message);
      setSession(data.token,data.user);
      location.href='index.html';
    }catch(err){ alert(err.message||'Login failed'); }
  });
}

// LOGOUT
function setupLogout(){
  document.querySelectorAll('#logout-btn,#admin-logout-btn').forEach(btn=>{
    btn?.addEventListener('click',()=>{
      sessionStorage.clear();
      location.href='login.html';
    });
  });
}
document.addEventListener('DOMContentLoaded',setupLogout);
