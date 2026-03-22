// RETROCULT — Complete App
// npm create vite@latest retrocult -- --template react
// npm install firebase
// paste into src/App.jsx → npm run dev

import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, updateProfile,
} from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, arrayUnion, arrayRemove, getDocs,
} from "firebase/firestore";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const FB = {
  apiKey: "AIzaSyCAfUtOyrXbThhYCC7G9oV2RplkwiKuUDQ",
  authDomain: "retrocult.firebaseapp.com",
  projectId: "retrocult",
  storageBucket: "retrocult.firebasestorage.app",
  messagingSenderId: "186078437303",
  appId: "1:186078437303:web:162debe676f209f5599232",
};
const app = initializeApp(FB);
const auth = getAuth(app);
const db = getFirestore(app);
const gp = new GoogleAuthProvider();

const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjNGNhZjE5NzMyOWI4ZmY3ZjM2MDQ4MmFiZmQyYzk3ZiIsIm5iZiI6MTc3NDIwMjcyMy43OTIsInN1YiI6IjY5YzAyZjYzOTY2YmE0NzNmNjAxY2NlNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Hmyb6vmr1eQ8MU2_QmbSw2XpFVR9-w6PFmDxxsDtTgo";
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/";
const TH = { Authorization: `Bearer ${TMDB_TOKEN}` };

async function api(path) {
  try { const r = await fetch(`${TMDB}${path}`, { headers: TH }); return await r.json(); }
  catch { return { results: [] }; }
}
function tmdbMovie(m) {
  return {
    id: m.id, title: m.title || m.name || "Untitled",
    year: (m.release_date || m.first_air_date || "").slice(0, 4),
    rating: m.vote_average ? Number(m.vote_average).toFixed(1) : "—",
    lang: (m.original_language || "").toUpperCase(),
    genre: (m.genres || []).map(g => g.name),
    description: m.overview || "No description.",
    reviews: m.vote_count || 0,
    posterPath: m.poster_path || null,
    backdropPath: m.backdrop_path || null,
    runtime: m.runtime || null, status: m.status || null,
    budget: m.budget || null, revenue: m.revenue || null,
  };
}

const PBG = ["#f0e6d3","#d3e8f0","#e8d3f0","#d3f0e0","#f5d3d3","#e8f0d3"];
const timeAgo = ts => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`;
};

// ── AUTH CONTEXT ──────────────────────────────────────────────────────────────
const Ctx = createContext(null);
const useAuth = () => useContext(Ctx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);

  const loadProfile = async (u) => {
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists()) { setProfile(snap.data()); return snap.data(); }
    const p = {
      uid: u.uid, email: u.email,
      displayName: u.displayName || u.email.split("@")[0],
      username: (u.displayName || u.email.split("@")[0]).toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20),
      bio: "Film enthusiast.", photoURL: u.photoURL || null,
      followers: [], following: [], watchlist: [], seenList: [], favourites: [],
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", u.uid), p);
    setProfile(p); return p;
  };

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); if (u) loadProfile(u); else setProfile(null); }), []);
  const refresh = () => user && loadProfile(user);

  return <Ctx.Provider value={{ user, profile, refresh }}>{children}</Ctx.Provider>;
}

// ── ATOMS ─────────────────────────────────────────────────────────────────────
function Poster({ movie, size = 52 }) {
  const src = movie?.posterPath ? `${IMG}${size > 80 ? "w342" : "w185"}${movie.posterPath}` : null;
  const bg = PBG[(movie?.id||0) % PBG.length];
  const ini = (movie?.title||"").split(" ").map(w=>w[0]).join("").slice(0,3);
  if (src) return <img src={src} alt={movie.title} style={{width:size,minWidth:size,height:size*1.45,borderRadius:6,objectFit:"cover",border:"1px solid rgba(0,0,0,0.08)",display:"block"}}/>;
  return <div style={{width:size,minWidth:size,height:size*1.45,background:bg,borderRadius:6,border:"1px solid rgba(0,0,0,0.08)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3}}><div style={{fontSize:16,opacity:0.4}}>◈</div><div style={{fontSize:8,fontWeight:700,color:"#6a5a48",textAlign:"center",padding:"0 3px"}}>{ini}</div></div>;
}

function Avt({ name="?", photo=null, size=36, bg="#fde8c8", color="#7a4a08", onClick=null }) {
  const ini = (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const cursor = onClick ? "pointer" : "default";
  const ring = onClick ? {outline:"2px solid transparent",transition:"outline 0.15s"} : {};
  if (photo) return <img src={photo} alt={name} onClick={onClick} style={{width:size,height:size,minWidth:size,borderRadius:"50%",objectFit:"cover",border:"1.5px solid rgba(0,0,0,0.08)",flexShrink:0,cursor,...ring}}/>;
  return <div onClick={onClick} style={{width:size,minWidth:size,height:size,borderRadius:"50%",background:bg,color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.33,fontWeight:600,border:"1.5px solid rgba(0,0,0,0.06)",flexShrink:0,cursor,...ring}}>{ini}</div>;
}

function Star({ rating }) {
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,background:"#fffbf0",border:"1px solid #e8d060",borderRadius:4,padding:"2px 7px",fontSize:11}}><span style={{color:"#c8a010"}}>★</span><span style={{fontWeight:600,color:"#7a5808"}}>{rating}</span></span>;
}

function Chip({ label, v="gray" }) {
  const s={gray:{bg:"#f4f2ee",c:"#5a5248",b:"#e5e0d8"},amber:{bg:"#fff5e0",c:"#8a5a08",b:"#e8d080"},blue:{bg:"#eef3ff",c:"#2a55a8",b:"#c0d0f8"},green:{bg:"#edf7ed",c:"#2a7a2a",b:"#b0ddb0"},red:{bg:"#fef0f0",c:"#c0392b",b:"#f5c0c0"}}[v]||{bg:"#f4f2ee",c:"#5a5248",b:"#e5e0d8"};
  return <span style={{fontSize:10,fontWeight:500,padding:"2px 8px",borderRadius:4,background:s.bg,color:s.c,border:`1px solid ${s.b}`,whiteSpace:"nowrap"}}>{label}</span>;
}

function SHead({ title, sub, cta, onCta }) {
  return <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #ede9e3"}}><div style={{display:"flex",alignItems:"baseline",gap:8}}><span style={{fontSize:13,fontWeight:700,color:"#1a1410"}}>{title}</span>{sub&&<span style={{fontSize:11,color:"#9a9088"}}>{sub}</span>}</div>{cta&&<span onClick={onCta} style={{fontSize:11,color:"#c8860a",cursor:"pointer",fontWeight:500}}>{cta}</span>}</div>;
}

function HR({ my=16 }) { return <div style={{height:1,background:"#ede9e3",margin:`${my}px 0`}}/>; }

function Spin() {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 0"}}><div style={{width:24,height:24,border:"2px solid #e5e0d8",borderTopColor:"#c8860a",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
}

function Btn({ children, onClick, primary, danger, ghost, full, disabled, style:sx={} }) {
  const bg = primary?"#c8860a":danger?"#c0392b":"#fff";
  const color = primary||danger?"#fff":"#4a4038";
  const border = primary||danger?"none":"1px solid #e5e0d8";
  return <button onClick={onClick} disabled={disabled} style={{background:bg,color,border,borderRadius:6,padding:"8px 16px",fontSize:12,fontWeight:primary?600:400,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",width:full?"100%":"auto",opacity:disabled?0.6:1,...sx}}>{children}</button>;
}

function Inp({ label, type="text", value, onChange, placeholder, error, multiline }) {
  const base = {width:"100%",padding:"9px 12px",background:"#faf8f5",border:`1px solid ${error?"#c0392b":"#e5e0d8"}`,borderRadius:7,fontSize:13,color:"#1a1410",outline:"none",fontFamily:"inherit"};
  return <div style={{marginBottom:14}}>
    {label&&<div style={{fontSize:11,fontWeight:600,color:"#5a5048",marginBottom:5}}>{label}</div>}
    {multiline
      ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} style={{...base,resize:"vertical"}}/>
      : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={base}/>}
    {error&&<div style={{fontSize:11,color:"#c0392b",marginTop:4}}>{error}</div>}
  </div>;
}

function Modal({ title, onClose, children }) {
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #ede9e3",padding:28,width:"100%",maxWidth:480,boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h3 style={{fontSize:16,fontWeight:700,color:"#1a1410",fontFamily:"Georgia,serif"}}>{title}</h3>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#9a9088"}}>×</button>
      </div>
      {children}
    </div>
  </div>;
}

// ── AUTH PAGE ─────────────────────────────────────────────────────────────────
function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [name, setName] = useState("");
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      if (mode==="signup") { const c = await createUserWithEmailAndPassword(auth,email,pw); await updateProfile(c.user,{displayName:name}); }
      else await signInWithEmailAndPassword(auth,email,pw);
    } catch(e) { setErr(e.message.replace("Firebase: ","").replace(/\(auth\/.*\)/,"").trim()); }
    setLoading(false);
  }

  async function google() {
    setErr(""); setLoading(true);
    try { await signInWithPopup(auth,gp); } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  return <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#fdf5e8,#f5f2ec)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:"100%",maxWidth:400}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:36,height:24,background:"#1a1410",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
            <div style={{width:11,height:11,borderRadius:"50%",background:"#c8860a"}}/>
            <div style={{position:"absolute",left:-5,top:"50%",transform:"translateY(-50%)",width:5,height:5,borderRadius:"50%",background:"#ccc"}}/>
            <div style={{position:"absolute",right:-5,top:"50%",transform:"translateY(-50%)",width:5,height:5,borderRadius:"50%",background:"#ccc"}}/>
          </div>
          <span style={{fontSize:22,fontWeight:700,color:"#1a1410",letterSpacing:3,fontFamily:"Georgia,serif"}}>RETROCULT</span>
        </div>
        <div style={{fontSize:13,color:"#9a9088"}}>Cinema for the devoted</div>
      </div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #ede9e3",padding:28,boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
        <h2 style={{fontSize:18,fontWeight:700,color:"#1a1410",fontFamily:"Georgia,serif",marginBottom:20}}>{mode==="login"?"Welcome back":"Create your account"}</h2>
        {err&&<div style={{background:"#fef0f0",border:"1px solid #f5c0c0",borderRadius:6,padding:"8px 12px",fontSize:12,color:"#c0392b",marginBottom:14}}>{err}</div>}
        <form onSubmit={submit}>
          {mode==="signup"&&<Inp label="Full Name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>}
          <Inp label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com"/>
          <Inp label="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••"/>
          <Btn primary full disabled={loading} style={{marginBottom:12,padding:"10px 0"}}>{loading?"Please wait...":mode==="login"?"Sign In":"Create Account"}</Btn>
        </form>
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0"}}><div style={{flex:1,height:1,background:"#ede9e3"}}/><span style={{fontSize:11,color:"#b0a898"}}>or</span><div style={{flex:1,height:1,background:"#ede9e3"}}/></div>
        <button onClick={google} disabled={loading} style={{width:"100%",background:"#fff",border:"1px solid #e5e0d8",borderRadius:6,padding:"9px 0",fontSize:13,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:"#3a3028",fontWeight:500}}>
          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>
        <div style={{textAlign:"center",marginTop:18,fontSize:12,color:"#9a9088"}}>
          {mode==="login"?"Don't have an account? ":"Already have an account? "}
          <span onClick={()=>{setMode(mode==="login"?"signup":"login");setErr("");}} style={{color:"#c8860a",cursor:"pointer",fontWeight:600}}>{mode==="login"?"Sign up":"Sign in"}</span>
        </div>
      </div>
    </div>
  </div>;
}

// ── POST COMPOSER ─────────────────────────────────────────────────────────────
function Composer({ user, profile, onDone }) {
  const [text, setText] = useState(""); const [film, setFilm] = useState(""); const [rating, setRating] = useState(""); const [busy, setBusy] = useState(false);
  async function post() {
    if (!text.trim()) return; setBusy(true);
    await addDoc(collection(db,"posts"), { text:text.trim(), movieTitle:film.trim()||null, rating:rating||null, uid:user.uid, userName:profile?.displayName||user.displayName||"User", userHandle:profile?.username||user.email?.split("@")[0]||"user", userPhoto:user.photoURL||null, likes:[], createdAt:serverTimestamp() });
    setText(""); setFilm(""); setRating(""); setBusy(false); if(onDone) onDone();
  }
  return <div style={{background:"#fff",border:"1px solid #ede9e3",borderRadius:10,padding:16,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
    <div style={{display:"flex",gap:10,marginBottom:10}}>
      <Avt name={profile?.displayName||user?.displayName||"U"} photo={user?.photoURL}/>
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Share your thoughts on a film..." style={{flex:1,background:"#faf8f5",border:"1px solid #e5e0d8",borderRadius:8,padding:"9px 12px",fontSize:13,fontFamily:"Georgia,serif",color:"#1a1410",outline:"none",resize:"none",minHeight:72}}/>
    </div>
    <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <input value={film} onChange={e=>setFilm(e.target.value)} placeholder="Film title (optional)" style={{flex:1,padding:"6px 10px",background:"#faf8f5",border:"1px solid #e5e0d8",borderRadius:6,fontSize:12,fontFamily:"inherit",color:"#1a1410",outline:"none"}}/>
      <select value={rating} onChange={e=>setRating(e.target.value)} style={{padding:"6px 10px",background:"#faf8f5",border:"1px solid #e5e0d8",borderRadius:6,fontSize:12,fontFamily:"inherit",color:"#1a1410",outline:"none"}}>
        <option value="">Rating</option>
        {[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>★ {n}</option>)}
      </select>
      <Btn primary onClick={post} disabled={!text.trim()||busy}>{busy?"Posting...":"Post"}</Btn>
    </div>
  </div>;
}

// ── POST CARD ─────────────────────────────────────────────────────────────────
function PostCard({ post, uid, onDelete, onUser, depth=0 }) {
  const { user, profile } = useAuth();
  const [liked, setLiked] = useState((post.likes||[]).includes(uid));
  const [lc, setLc] = useState((post.likes||[]).length);
  const [showReply, setShowReply] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replies, setReplies] = useState([]);
  const [showReplies, setShowReplies] = useState(false);
  const [replyCount, setReplyCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // get reply count live
    const q = query(collection(db, "replies"), where("postId","==", post.id), orderBy("createdAt","asc"));
    return onSnapshot(q, snap => {
      setReplies(snap.docs.map(d=>({id:d.id,...d.data()})));
      setReplyCount(snap.docs.length);
    });
  }, [post.id]);

  async function toggleLike() {
    if (!uid) return;
    const ref = doc(db,"posts",post.id);
    if (liked) { await updateDoc(ref,{likes:arrayRemove(uid)}); setLc(c=>c-1); }
    else { await updateDoc(ref,{likes:arrayUnion(uid)}); setLc(c=>c+1); }
    setLiked(l=>!l);
  }

  async function submitReply() {
    if (!replyText.trim() || !uid) return;
    await addDoc(collection(db,"replies"), {
      postId: post.id,
      text: replyText.trim(),
      uid,
      userName: profile?.displayName || "User",
      userHandle: profile?.username || "user",
      userPhoto: profile?.photoURL || user?.photoURL || null,
      likes: [],
      createdAt: serverTimestamp(),
    });
    setReplyText(""); setShowReply(false); setShowReplies(true);
  }

  async function del() {
    if (post.uid!==uid) return;
    if (window.confirm("Delete this post?")) await deleteDoc(doc(db,"posts",post.id));
  }

  function copyLink() {
    navigator.clipboard.writeText(`Check out this post by @${post.userHandle} on RetroCult: "${post.text.slice(0,60)}..."`);
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  }

  const goUser = () => onUser && post.uid && onUser(post.uid);

  return <div style={{background:"#fff",border:"1px solid #ede9e3",borderRadius:12,marginBottom:12,boxShadow:"0 1px 6px rgba(0,0,0,0.05)",overflow:"hidden"}}>
    {/* Post header */}
    <div style={{padding:"14px 16px 0"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <Avt name={post.userName||"User"} photo={post.userPhoto} size={40} onClick={goUser}/>
        <div style={{flex:1,minWidth:0}}>
          {/* Name + time row */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span onClick={goUser} style={{fontSize:13,fontWeight:700,color:"#1a1410",cursor:onUser?"pointer":"default"}}>{post.userName||"User"}</span>
              <span onClick={goUser} style={{fontSize:12,color:"#9a9088",cursor:onUser?"pointer":"default"}}>@{post.userHandle||"user"}</span>
              {post.movieTitle&&<>
                <span style={{fontSize:11,color:"#d5cfc8"}}>·</span>
                <span style={{fontSize:11,color:"#c8860a",fontWeight:500,background:"#fff8ef",padding:"1px 7px",borderRadius:10,border:"1px solid #f0d8a0"}}>📽 {post.movieTitle}</span>
              </>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:"#b0a898"}}>{timeAgo(post.createdAt)}</span>
              {post.uid===uid&&<button onClick={del} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#d5cfc8",padding:0,lineHeight:1}} title="Delete">✕</button>}
            </div>
          </div>
          {/* Rating */}
          {post.rating&&<div style={{marginBottom:6}}><Star rating={post.rating}/></div>}
          {/* Post text */}
          <p style={{fontSize:14,color:"#2a2420",lineHeight:1.75,fontFamily:"Georgia,serif",margin:"6px 0 12px",wordBreak:"break-word"}}>{post.text}</p>
        </div>
      </div>

      {/* Action bar */}
      <div style={{display:"flex",alignItems:"center",gap:0,borderTop:"1px solid #f5f2ee",margin:"0 -16px",padding:"2px 8px"}}>
        {/* Like */}
        <button onClick={toggleLike} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",border:"none",cursor:uid?"pointer":"default",padding:"9px 0",fontSize:13,color:liked?"#e05a2b":"#9a9088",fontWeight:liked?600:400,fontFamily:"inherit",borderRadius:6,transition:"background 0.1s"}}
          onMouseEnter={e=>e.currentTarget.style.background="#fdf5f3"}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <span style={{fontSize:15}}>{liked?"♥":"♡"}</span>
          <span style={{fontSize:12}}>{lc > 0 ? lc : ""} Like</span>
        </button>
        {/* Reply */}
        <button onClick={()=>setShowReply(r=>!r)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:"9px 0",fontSize:13,color:showReply?"#c8860a":"#9a9088",fontFamily:"inherit",borderRadius:6,transition:"background 0.1s"}}
          onMouseEnter={e=>e.currentTarget.style.background="#fdf8f0"}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <span style={{fontSize:14}}>💬</span>
          <span style={{fontSize:12}}>{replyCount > 0 ? replyCount : ""} Reply</span>
        </button>
        {/* Share */}
        <button onClick={()=>setShowShare(s=>!s)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:"9px 0",fontSize:13,color:showShare?"#2a55a8":"#9a9088",fontFamily:"inherit",borderRadius:6,transition:"background 0.1s"}}
          onMouseEnter={e=>e.currentTarget.style.background="#f0f4ff"}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <span style={{fontSize:14}}>↗</span>
          <span style={{fontSize:12}}>Share</span>
        </button>
      </div>
    </div>

    {/* Reply composer */}
    {showReply&&uid&&<div style={{padding:"12px 16px",borderTop:"1px solid #f5f2ee",background:"#faf8f5"}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <Avt name={profile?.displayName||"U"} photo={profile?.photoURL} size={30}/>
        <div style={{flex:1}}>
          <textarea value={replyText} onChange={e=>setReplyText(e.target.value)}
            placeholder={`Reply to @${post.userHandle}...`}
            style={{width:"100%",padding:"8px 12px",background:"#fff",border:"1px solid #e5e0d8",borderRadius:8,fontSize:13,fontFamily:"Georgia,serif",color:"#1a1410",outline:"none",resize:"none",minHeight:60}}/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
            <Btn onClick={()=>{setShowReply(false);setReplyText("");}}>Cancel</Btn>
            <Btn primary onClick={submitReply} disabled={!replyText.trim()}>Reply</Btn>
          </div>
        </div>
      </div>
    </div>}

    {/* Share panel */}
    {showShare&&<div style={{padding:"12px 16px",borderTop:"1px solid #f5f2ee",background:"#f8f8ff"}}>
      <div style={{fontSize:11,fontWeight:600,color:"#5a5048",marginBottom:10,letterSpacing:0.5}}>SHARE THIS POST</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={copyLink} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",background:copied?"#edf7ed":"#fff",color:copied?"#2a7a2a":"#3a3028",border:`1px solid ${copied?"#b0ddb0":"#e5e0d8"}`,borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>
          {copied?"✓ Copied!":"📋 Copy"}
        </button>
        <button onClick={()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`"${post.text.slice(0,100)}" — @${post.userHandle} on RetroCult`)}`, "_blank")}
          style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",background:"#1da1f2",color:"#fff",border:"none",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>
          𝕏 Twitter
        </button>
        <button onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(`"${post.text.slice(0,100)}" — @${post.userHandle} on RetroCult`)}`, "_blank")}
          style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",background:"#25d366",color:"#fff",border:"none",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>
          WhatsApp
        </button>
      </div>
    </div>}

    {/* Replies */}
    {replyCount>0&&<div style={{borderTop:"1px solid #f5f2ee"}}>
      <button onClick={()=>setShowReplies(r=>!r)} style={{width:"100%",padding:"8px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#9a9088",textAlign:"left",fontFamily:"inherit"}}>
        {showReplies?"▲ Hide":"▼ Show"} {replyCount} {replyCount===1?"reply":"replies"}
      </button>
      {showReplies&&<div style={{padding:"0 16px 12px"}}>
        {replies.map(r=><ReplyCard key={r.id} reply={r} uid={uid} onUser={onUser}/>)}
      </div>}
    </div>}
  </div>;
}

function ReplyCard({ reply, uid, onUser }) {
  const [liked, setLiked] = useState((reply.likes||[]).includes(uid));
  const [lc, setLc] = useState((reply.likes||[]).length);

  async function toggleLike() {
    if (!uid) return;
    const ref = doc(db,"replies",reply.id);
    if (liked) { await updateDoc(ref,{likes:arrayRemove(uid)}); setLc(c=>c-1); }
    else { await updateDoc(ref,{likes:arrayUnion(uid)}); setLc(c=>c+1); }
    setLiked(l=>!l);
  }

  return <div style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid #f5f2ee"}}>
    <Avt name={reply.userName||"U"} photo={reply.userPhoto} size={30} onClick={()=>onUser&&reply.uid&&onUser(reply.uid)}/>
    <div style={{flex:1}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
        <span onClick={()=>onUser&&reply.uid&&onUser(reply.uid)} style={{fontSize:12,fontWeight:700,color:"#1a1410",cursor:onUser?"pointer":"default"}}>{reply.userName}</span>
        <span style={{fontSize:11,color:"#9a9088"}}>@{reply.userHandle}</span>
        <span style={{fontSize:11,color:"#b0a898",marginLeft:"auto"}}>{timeAgo(reply.createdAt)}</span>
      </div>
      <p style={{fontSize:13,color:"#3a3028",lineHeight:1.6,fontFamily:"Georgia,serif",marginBottom:6}}>{reply.text}</p>
      <button onClick={toggleLike} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:liked?"#e05a2b":"#9a9088",padding:0,fontFamily:"inherit"}}>
        {liked?"♥":"♡"} {lc>0?lc:""} Like
      </button>
    </div>
  </div>;
}

// ── MOVIE ROW ─────────────────────────────────────────────────────────────────
function MovieRow({ movie, onClick }) {
  const [hov,setHov] = useState(false);
  return <div onClick={()=>onClick(movie)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{display:"flex",gap:12,padding:"10px 8px",borderBottom:"1px solid #ede9e3",cursor:"pointer",borderRadius:6,background:hov?"#faf7f3":"transparent",transition:"background 0.12s"}}>
    <Poster movie={movie} size={46}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:14,fontWeight:600,color:"#1a1410",marginBottom:2,fontFamily:"Georgia,serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{movie.title}</div>
      <div style={{fontSize:11,color:"#9a9088",marginBottom:5}}>{movie.year} · {movie.lang}</div>
      <div style={{display:"flex",gap:6}}><Star rating={movie.rating}/><span style={{fontSize:10,color:"#b0a898",alignSelf:"center"}}>{movie.reviews.toLocaleString()} votes</span></div>
    </div>
  </div>;
}

// ── MOVIE CARD ────────────────────────────────────────────────────────────────
function MovieCard({ movie, onClick }) {
  const [hov,setHov] = useState(false);
  return <div onClick={()=>onClick(movie)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{background:"#fff",border:"1px solid #ede9e3",borderRadius:10,overflow:"hidden",cursor:"pointer",transition:"transform 0.15s,box-shadow 0.15s",transform:hov?"translateY(-3px)":"none",boxShadow:hov?"0 6px 20px rgba(0,0,0,0.08)":"0 1px 4px rgba(0,0,0,0.04)"}}>
    <div style={{position:"relative",height:200,background:PBG[(movie.id||0)%PBG.length],overflow:"hidden"}}>
      {movie.posterPath&&<img src={`${IMG}w342${movie.posterPath}`} alt={movie.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
      <div style={{position:"absolute",top:8,right:8}}><Star rating={movie.rating}/></div>
      {movie.lang&&<div style={{position:"absolute",top:8,left:8}}><Chip label={movie.lang} v="blue"/></div>}
    </div>
    <div style={{padding:"10px 12px 12px"}}>
      <div style={{fontSize:13,fontWeight:600,color:"#1a1410",marginBottom:2,fontFamily:"Georgia,serif",lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{movie.title}</div>
      <div style={{fontSize:11,color:"#9a9088"}}>{movie.year} · {movie.reviews.toLocaleString()} votes</div>
    </div>
  </div>;
}

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
const FTABS = [
  {id:"now_playing",label:"Now Playing",path:"/movie/now_playing?language=en-US"},
  {id:"popular",label:"Popular",path:"/movie/popular?language=en-US"},
  {id:"upcoming",label:"Upcoming",path:"/movie/upcoming?language=en-US"},
  {id:"top_rated",label:"Top Rated",path:"/movie/top_rated?language=en-US"},
];

function HomePage({ onMovie, onUser }) {
  const {user,profile} = useAuth();
  const [tab,setTab] = useState("now_playing");
  const [movies,setMovies] = useState([]); const [mLoad,setMLoad] = useState(true);
  const [trending,setTrending] = useState([]);
  const [posts,setPosts] = useState([]); const [pLoad,setPLoad] = useState(true);

  useEffect(()=>{
    api("/trending/movie/week").then(d=>setTrending((d.results||[]).slice(0,8).map(tmdbMovie)));
  },[]);

  useEffect(()=>{
    setMLoad(true);
    api(FTABS.find(t=>t.id===tab).path).then(d=>{setMovies((d.results||[]).slice(0,10).map(tmdbMovie));setMLoad(false);});
  },[tab]);

  useEffect(()=>{
    const q = query(collection(db,"posts"),orderBy("createdAt","desc"),limit(30));
    return onSnapshot(q,snap=>{setPosts(snap.docs.map(d=>({id:d.id,...d.data()})));setPLoad(false);});
  },[]);

  return <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
    <div style={{flex:1,overflowY:"auto",borderRight:"1px solid #ede9e3"}}>
      {/* Tab bar */}
      <div style={{background:"#fff",borderBottom:"1px solid #ede9e3",padding:"0 24px",display:"flex",position:"sticky",top:0,zIndex:10}}>
        {FTABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?"#c8860a":"transparent"}`,cursor:"pointer",padding:"12px 16px",fontSize:12,fontWeight:tab===t.id?600:400,color:tab===t.id?"#c8860a":"#7a7068",fontFamily:"inherit"}}>{t.label}</button>)}
      </div>
      {/* Pinned composer */}
      {user&&<div style={{background:"#fff",borderBottom:"1px solid #ede9e3",padding:"14px 24px"}}>
        <Composer user={user} profile={profile}/>
      </div>}
      <div style={{padding:"20px 24px"}}>
        {/* Community */}
        <SHead title="Community Feed" sub="What members are saying"/>
        {pLoad?<Spin/>:posts.length===0?<div style={{color:"#9a9088",fontSize:13,fontStyle:"italic",padding:"24px 0",textAlign:"center"}}>No posts yet — be the first to share!</div>:posts.map(p=><PostCard key={p.id} post={p} uid={user?.uid} onUser={onUser}/>)}
        <HR my={24}/>
        {/* TMDB feed */}
        <SHead title={FTABS.find(t=>t.id===tab)?.label} sub={mLoad?"Loading...":`${movies.length} films`}/>
        {mLoad?<Spin/>:movies.map(m=><FeedCard key={m.id} movie={m} onMovie={onMovie} uid={user?.uid} profile={profile}/>)}
      </div>
    </div>
    {/* Sidebar */}
    <div style={{width:280,minWidth:280,overflowY:"auto",padding:"20px 18px"}}>
      <SHead title="Trending This Week"/>
      {trending.length===0?<Spin/>:trending.map(m=><MovieRow key={m.id} movie={m} onClick={onMovie}/>)}
      <HR my={20}/>
      <NewsSection/>
    </div>
  </div>;
}

function FeedCard({ movie, onMovie, uid, profile }) {
  const [liked,setLiked] = useState(false);
  const [inWL,setInWL] = useState(false);

  useEffect(()=>{
    if (!uid) return;
    getDoc(doc(db,"users",uid)).then(s=>{const d=s.data()||{};setInWL((d.watchlist||[]).includes(movie.id));});
  },[uid,movie.id]);

  async function toggleWL(e) {
    e.stopPropagation(); if(!uid) return;
    const ref=doc(db,"users",uid);
    if(inWL){await updateDoc(ref,{watchlist:arrayRemove(movie.id)});setInWL(false);}
    else{await updateDoc(ref,{watchlist:arrayUnion(movie.id)});setInWL(true);}
  }

  return <div onClick={()=>onMovie(movie)} style={{background:"#fff",border:"1px solid #ede9e3",borderRadius:10,padding:14,marginBottom:10,display:"flex",gap:14,cursor:"pointer"}}>
    <Poster movie={movie} size={56}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
        <div style={{fontSize:14,fontWeight:600,color:"#1a1410",fontFamily:"Georgia,serif",flex:1,marginRight:8}}>{movie.title}</div>
        <Star rating={movie.rating}/>
      </div>
      <div style={{fontSize:11,color:"#9a9088",marginBottom:6}}>{movie.year} · {movie.lang} · {movie.reviews.toLocaleString()} votes</div>
      <p style={{fontSize:12,color:"#5a5048",lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{movie.description}</p>
      <div style={{marginTop:8,display:"flex",gap:8}}>
        <Btn onClick={e=>{e.stopPropagation();setLiked(l=>!l);}} sx={{fontSize:11,padding:"4px 10px"}} style={{fontSize:11,padding:"4px 10px",color:liked?"#e05a2b":"#4a4038"}}>{liked?"♥ Liked":"♡ Like"}</Btn>
        <Btn onClick={toggleWL} style={{fontSize:11,padding:"4px 10px",background:inWL?"#edf7ed":"#fff",color:inWL?"#2a7a2a":"#4a4038",border:`1px solid ${inWL?"#b0ddb0":"#e5e0d8"}`}}>{inWL?"✓ Watchlist":"+ Watchlist"}</Btn>
      </div>
    </div>
  </div>;
}

function NewsSection() {
  const [news,setNews] = useState([]);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    // Use TMDB upcoming + now_playing as "news"
    Promise.all([
      api("/movie/upcoming?language=en-US"),
      api("/movie/now_playing?language=en-US"),
    ]).then(([u,n])=>{
      const items = [
        ...(u.results||[]).slice(0,3).map(m=>({tag:"Upcoming",title:`${m.title} — releasing ${m.release_date||"soon"}`,id:m.id,movie:tmdbMovie(m)})),
        ...(n.results||[]).slice(0,3).map(m=>({tag:"Now Playing",title:`${m.title} is now in theatres`,id:m.id,movie:tmdbMovie(m)})),
      ];
      setNews(items); setLoading(false);
    });
  },[]);

  return <>
    <SHead title="Cinema News"/>
    {loading?<Spin/>:news.map((n,i)=>(
      <div key={i} style={{paddingBottom:14,marginBottom:14,borderBottom:i<news.length-1?"1px solid #ede9e3":"none"}}>
        <Chip label={n.tag} v="amber"/>
        <div style={{fontSize:13,color:"#1a1410",lineHeight:1.5,fontWeight:500,marginTop:5,marginBottom:3}}>{n.title}</div>
        {n.movie?.posterPath&&<img src={`${IMG}w92${n.movie.posterPath}`} style={{width:"100%",height:60,objectFit:"cover",borderRadius:6,marginTop:4}}/>}
      </div>
    ))}
  </>;
}

// ── DISCOVER ──────────────────────────────────────────────────────────────────
const DFILTERS = [
  {id:"trending",label:"Trending",path:"/trending/movie/week"},
  {id:"top_rated",label:"Top Rated",path:"/movie/top_rated?language=en-US"},
  {id:"now_playing",label:"Now Playing",path:"/movie/now_playing?language=en-US"},
  {id:"upcoming",label:"Upcoming",path:"/movie/upcoming?language=en-US"},
  {id:"ta",label:"Tamil",path:"/discover/movie?with_original_language=ta&sort_by=popularity.desc"},
  {id:"hi",label:"Hindi",path:"/discover/movie?with_original_language=hi&sort_by=popularity.desc"},
  {id:"ml",label:"Malayalam",path:"/discover/movie?with_original_language=ml&sort_by=popularity.desc"},
  {id:"te",label:"Telugu",path:"/discover/movie?with_original_language=te&sort_by=popularity.desc"},
  {id:"kn",label:"Kannada",path:"/discover/movie?with_original_language=kn&sort_by=popularity.desc"},
  {id:"bn",label:"Bengali",path:"/discover/movie?with_original_language=bn&sort_by=popularity.desc"},
];

function DiscoverPage({ onMovie }) {
  const [filter,setFilter] = useState("trending");
  const [q,setQ] = useState("");
  const [movies,setMovies] = useState([]); const [loading,setLoading] = useState(true);
  const [page,setPage] = useState(1); const [hasMore,setHasMore] = useState(false);
  const deb = useRef(null);

  function load(f,qv,p=1) {
    if(p===1){setLoading(true);setMovies([]);}
    const isSearch = qv.trim().length>1;
    const base = isSearch
      ? `/search/movie?query=${encodeURIComponent(qv.trim())}&page=${p}`
      : DFILTERS.find(x=>x.id===f)?.path+(DFILTERS.find(x=>x.id===f)?.path.includes("?")?"&":"?")+`page=${p}`;
    api(base).then(d=>{
      setMovies(prev=>p===1?(d.results||[]).map(tmdbMovie):[...prev,...(d.results||[]).map(tmdbMovie)]);
      setHasMore(p<(d.total_pages||1)); setLoading(false);
    });
  }

  useEffect(()=>{setPage(1);load(filter,q,1);},[filter]);
  useEffect(()=>{clearTimeout(deb.current);deb.current=setTimeout(()=>{setPage(1);load(filter,q,1);},400);},[q]);

  return <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{background:"#fff",borderBottom:"1px solid #ede9e3",padding:"16px 24px"}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search any film, director, actor..." style={{width:"100%",padding:"9px 14px",background:"#f5f3ef",border:"1px solid #e5e0d8",borderRadius:8,fontSize:13,color:"#2a2420",outline:"none",fontFamily:"inherit",marginBottom:12}}/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {DFILTERS.map(f=><button key={f.id} onClick={()=>{setQ("");setFilter(f.id);}} style={{padding:"5px 13px",borderRadius:6,fontSize:12,cursor:"pointer",fontWeight:filter===f.id&&!q?600:400,background:filter===f.id&&!q?"#c8860a":"#f5f3ef",color:filter===f.id&&!q?"#fff":"#6a6058",border:`1px solid ${filter===f.id&&!q?"#c8860a":"#e5e0d8"}`,fontFamily:"inherit"}}>{f.label}</button>)}
      </div>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
      <SHead title={q.trim().length>1?`Results for "${q}"`:DFILTERS.find(f=>f.id===filter)?.label} sub={loading&&movies.length===0?"Loading...":`${movies.length} films`}/>
      {loading&&movies.length===0?<Spin/>:<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
          {movies.map(m=><MovieCard key={m.id} movie={m} onClick={onMovie}/>)}
        </div>
        {hasMore&&!loading&&<div style={{textAlign:"center",marginTop:24}}><Btn onClick={()=>{const n=page+1;setPage(n);load(filter,q,n);}}>Load more</Btn></div>}
        {loading&&movies.length>0&&<Spin/>}
      </>}
    </div>
  </div>;
}

// ── MOVIE DETAIL ──────────────────────────────────────────────────────────────
function MovieDetail({ movie, onBack, onMovie }) {
  const {user,profile} = useAuth();
  const [tab,setTab] = useState("overview");
  const [detail,setDetail] = useState(null); const [credits,setCredits] = useState(null); const [similar,setSimilar] = useState([]);
  const [reviews,setReviews] = useState([]);
  const [inWL,setInWL] = useState(false); const [seen,setSeen] = useState(false); const [fav,setFav] = useState(false);
  const [rText,setRText] = useState(""); const [rRating,setRRating] = useState(""); const [rBusy,setRBusy] = useState(false);
  const [showShare,setShowShare] = useState(false);
  const TABS = ["overview","cast & crew","similar","reviews"];

  useEffect(()=>{
    setDetail(null);setCredits(null);setSimilar([]);setTab("overview");
    Promise.all([api(`/movie/${movie.id}?language=en-US`),api(`/movie/${movie.id}/credits`),api(`/movie/${movie.id}/similar`)]).then(([d,c,s])=>{setDetail(d);setCredits(c);setSimilar((s.results||[]).slice(0,6).map(tmdbMovie));});
    if(user){
      getDoc(doc(db,"users",user.uid)).then(s=>{const d=s.data()||{};setInWL((d.watchlist||[]).includes(movie.id));setSeen((d.seenList||[]).includes(movie.id));setFav((d.favourites||[]).includes(movie.id));});
    }
    const q=query(collection(db,"reviews"),where("movieId","==",movie.id),orderBy("createdAt","desc"));
    return onSnapshot(q,snap=>setReviews(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[movie.id]);

  const m = detail?{...movie,...tmdbMovie(detail)}:movie;
  const director = credits?.crew?.find(p=>p.job==="Director");
  const cast = credits?.cast?.slice(0,8)||[];
  const bgSrc = (m.backdropPath||movie.backdropPath)?`${IMG}w780${m.backdropPath||movie.backdropPath}`:null;

  async function toggleWL(){if(!user)return;const ref=doc(db,"users",user.uid);if(inWL){await updateDoc(ref,{watchlist:arrayRemove(movie.id)});setInWL(false);}else{await updateDoc(ref,{watchlist:arrayUnion(movie.id)});setInWL(true);}}
  async function toggleSeen(){if(!user)return;const ref=doc(db,"users",user.uid);if(seen){await updateDoc(ref,{seenList:arrayRemove(movie.id)});setSeen(false);}else{await updateDoc(ref,{seenList:arrayUnion(movie.id)});setSeen(true);}}
  async function toggleFav(){if(!user)return;const ref=doc(db,"users",user.uid);if(fav){await updateDoc(ref,{favourites:arrayRemove(movie.id)});setFav(false);}else{await updateDoc(ref,{favourites:arrayUnion(movie.id)});setFav(true);}}

  async function submitReview(){
    if(!rText.trim()||!user)return; setRBusy(true);
    await addDoc(collection(db,"reviews"),{movieId:movie.id,movieTitle:movie.title,text:rText.trim(),rating:rRating||null,uid:user.uid,userName:profile?.displayName||user.displayName||"User",userHandle:profile?.username||user.email?.split("@")[0]||"user",userPhoto:user.photoURL||null,createdAt:serverTimestamp()});
    setRText("");setRRating("");setRBusy(false);
  }

  return <div style={{height:"100%",overflowY:"auto"}}>
    {/* Hero */}
    <div style={{position:"relative",minHeight:260,borderBottom:"1px solid #ede9e3"}}>
      {bgSrc&&<div style={{position:"absolute",inset:0,background:`url(${bgSrc}) center/cover`,opacity:0.15}}/>}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(248,244,238,0.5),#f8f4ee 90%)"}}/>
      <div style={{position:"relative",padding:"20px 28px 0"}}>
        <button onClick={onBack} style={{background:"#fff",border:"1px solid #d5cfc8",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12,color:"#6a6058",fontFamily:"inherit",marginBottom:18}}>← Back</button>
        <div style={{display:"flex",gap:22,alignItems:"flex-end"}}>
          <Poster movie={m} size={96}/>
          <div style={{paddingBottom:20}}>
            <div style={{fontSize:11,color:"#8a8078",marginBottom:5}}>{m.year}{m.lang?` · ${m.lang}`:""}{director?` · Dir. ${director.name}`:""}</div>
            <h1 style={{fontSize:28,fontWeight:700,color:"#1a1410",fontFamily:"Georgia,serif",lineHeight:1.1,marginBottom:10}}>{m.title}</h1>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <Star rating={m.rating}/>
              {(m.genre||[]).slice(0,3).map(g=><Chip key={g} label={g}/>)}
              <span style={{fontSize:11,color:"#9a9088"}}>{m.reviews.toLocaleString()} votes</span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",marginTop:14}}>
          {TABS.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t?"#c8860a":"transparent"}`,cursor:"pointer",padding:"9px 14px",fontSize:12,fontWeight:tab===t?600:400,color:tab===t?"#c8860a":"#7a7068",marginBottom:-1,fontFamily:"inherit",textTransform:"capitalize"}}>{t}</button>)}
        </div>
      </div>
    </div>

    <div style={{display:"flex"}}>
      <div style={{flex:1,padding:"24px 28px"}}>
        {tab==="overview"&&(!detail?<Spin/>:<>
          <p style={{fontSize:15,fontFamily:"Georgia,serif",fontStyle:"italic",lineHeight:1.8,color:"#3a3028",marginBottom:22}}>{m.description}</p>
          <HR/>
          <SHead title="Recent Reviews" sub={`${reviews.length} reviews`} cta="Write a review" onCta={()=>setTab("reviews")}/>
          {reviews.length===0?<div style={{color:"#9a9088",fontSize:13,fontStyle:"italic"}}>No reviews yet. Be the first!</div>:reviews.slice(0,3).map(r=><ReviewItem key={r.id} r={r}/>)}
        </>)}

        {tab==="cast & crew"&&(!credits?<Spin/>:<>
          {director&&<><SHead title="Director"/><div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid #ede9e3",marginBottom:20}}>{director.profile_path?<img src={`${IMG}w92${director.profile_path}`} style={{width:48,height:48,borderRadius:"50%",objectFit:"cover"}} alt={director.name}/>:<Avt name={director.name} size={48}/>}<div><div style={{fontSize:15,fontWeight:600,color:"#1a1410"}}>{director.name}</div><div style={{fontSize:11,color:"#9a9088"}}>Director</div></div></div></>}
          <SHead title="Cast" sub={`${cast.length} members`}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {cast.map(p=><div key={p.id} style={{background:"#fff",border:"1px solid #ede9e3",borderRadius:8,padding:12,textAlign:"center"}}>
              {p.profile_path?<img src={`${IMG}w92${p.profile_path}`} style={{width:52,height:52,borderRadius:"50%",objectFit:"cover",marginBottom:8}} alt={p.name}/>:<Avt name={p.name} size={52} bg="#f0e8f8" color="#7a3c98"/>}
              <div style={{fontSize:12,fontWeight:600,color:"#1a1410",marginTop:8}}>{p.name}</div>
              <div style={{fontSize:11,color:"#9a9088",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.character}</div>
            </div>)}
          </div>
        </>)}

        {tab==="similar"&&(similar.length===0?<Spin/>:<><SHead title="Similar Films"/>{similar.map(m2=><MovieRow key={m2.id} movie={m2} onClick={onMovie}/>)}</>)}

        {tab==="reviews"&&<>
          {user&&<div style={{background:"#fff",border:"1px solid #ede9e3",borderRadius:10,padding:16,marginBottom:20}}>
            <SHead title="Write a Review"/>
            <textarea value={rText} onChange={e=>setRText(e.target.value)} placeholder="What did you think of this film?" style={{width:"100%",background:"#faf8f5",border:"1px solid #e5e0d8",borderRadius:8,padding:12,fontSize:13,fontFamily:"Georgia,serif",color:"#1a1410",outline:"none",resize:"vertical",minHeight:80}}/>
            <div style={{display:"flex",gap:10,marginTop:10,alignItems:"center"}}>
              <select value={rRating} onChange={e=>setRRating(e.target.value)} style={{padding:"6px 10px",background:"#faf8f5",border:"1px solid #e5e0d8",borderRadius:6,fontSize:12,fontFamily:"inherit",color:"#1a1410",outline:"none"}}>
                <option value="">Rating</option>
                {[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>★ {n}</option>)}
              </select>
              <Btn primary onClick={submitReview} disabled={!rText.trim()||rBusy}>{rBusy?"Posting...":"Post Review"}</Btn>
            </div>
          </div>}
          <SHead title="All Reviews" sub={`${reviews.length} total`}/>
          {reviews.length===0?<div style={{color:"#9a9088",fontSize:13,fontStyle:"italic"}}>No reviews yet.</div>:reviews.map(r=><ReviewItem key={r.id} r={r}/>)}
        </>}
      </div>

      {/* Sidebar */}
      <div style={{width:220,minWidth:220,borderLeft:"1px solid #ede9e3",padding:"24px 18px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          <button onClick={toggleWL} style={{background:inWL?"#2a7a2a":"#c8860a",color:"#fff",border:"none",borderRadius:6,padding:"9px 0",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{inWL?"✓ In Watchlist":"+ Watchlist"}</button>
          <button onClick={toggleSeen} style={{background:seen?"#edf7ed":"#fff",color:seen?"#2a7a2a":"#4a4038",border:`1px solid ${seen?"#b0ddb0":"#e5e0d8"}`,borderRadius:6,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{seen?"✓ Seen This":"◎ Mark Seen"}</button>
          <button onClick={toggleFav} style={{background:fav?"#fff5e0":"#fff",color:fav?"#c8860a":"#4a4038",border:`1px solid ${fav?"#e8d080":"#e5e0d8"}`,borderRadius:6,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{fav?"♥ Favourited":"♡ Favourite"}</button>
          <button onClick={()=>setShowShare(true)} style={{background:"#fff",color:"#4a4038",border:"1px solid #e5e0d8",borderRadius:6,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>↗ Share</button>
        </div>
        <HR/>
        <div style={{fontSize:10,fontWeight:700,color:"#b0a898",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Film Info</div>
        {!detail?<Spin/>:[["Year",m.year],["Language",m.lang],["Runtime",detail.runtime?`${detail.runtime} min`:"—"],["Status",detail.status||"—"],["Budget",detail.budget?`$${(detail.budget/1e6).toFixed(0)}M`:"—"],["Revenue",detail.revenue?`$${(detail.revenue/1e6).toFixed(0)}M`:"—"],["Votes",m.reviews.toLocaleString()]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #ede9e3"}}>
            <span style={{fontSize:11,color:"#9a9088"}}>{k}</span>
            <span style={{fontSize:11,color:"#2a2420",fontWeight:500}}>{v}</span>
          </div>
        ))}
      </div>
    </div>

    {showShare&&<Modal title="Share this film" onClose={()=>setShowShare(false)}>
      <div style={{fontSize:13,color:"#5a5048",marginBottom:16}}>Share <b>{movie.title}</b> with friends:</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={()=>{navigator.clipboard.writeText(`Check out ${movie.title} on RetroCult!`);alert("Copied to clipboard!");}} style={{background:"#f5f3ef",border:"1px solid #e5e0d8",borderRadius:6,padding:"10px 16px",cursor:"pointer",fontSize:13,fontFamily:"inherit",textAlign:"left"}}>📋 Copy link</button>
        <button onClick={()=>window.open(`https://twitter.com/intent/tweet?text=Watching ${encodeURIComponent(movie.title)} — check it out on RetroCult!`,"_blank")} style={{background:"#1da1f2",color:"#fff",border:"none",borderRadius:6,padding:"10px 16px",cursor:"pointer",fontSize:13,fontFamily:"inherit",textAlign:"left"}}>Share on Twitter / X</button>
        <button onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${movie.title} on RetroCult!`)}`,"_blank")} style={{background:"#25d366",color:"#fff",border:"none",borderRadius:6,padding:"10px 16px",cursor:"pointer",fontSize:13,fontFamily:"inherit",textAlign:"left"}}>Share on WhatsApp</button>
      </div>
    </Modal>}
  </div>;
}

function ReviewItem({ r, onUser }) {
  return <div style={{padding:"14px 0",borderBottom:"1px solid #ede9e3"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
      <Avt name={r.userName||"U"} photo={r.userPhoto} size={28} onClick={()=>onUser&&r.uid&&onUser(r.uid)}/>
      <span onClick={()=>onUser&&r.uid&&onUser(r.uid)} style={{fontSize:12,fontWeight:600,color:"#1a1410",cursor:onUser?"pointer":"default"}}>@{r.userHandle}</span>
      {r.rating&&<Star rating={r.rating}/>}
      <span style={{fontSize:11,color:"#b0a898",marginLeft:"auto"}}>{timeAgo(r.createdAt)}</span>
    </div>
    <p style={{fontSize:13,fontFamily:"Georgia,serif",fontStyle:"italic",color:"#4a4038",lineHeight:1.6}}>"{r.text}"</p>
  </div>;
}

// ── CHAT PAGE ─────────────────────────────────────────────────────────────────
function ChatPage({ onUser }) {
  const {user,profile} = useAuth();
  const [msgs,setMsgs] = useState([]); const [text,setText] = useState(""); const [room,setRoom] = useState("general");
  const bottomRef = useRef(null);
  const ROOMS = ["general","tamil-cinema","world-cinema","recommendations","reviews"];

  useEffect(()=>{
    const q=query(collection(db,"chat_"+room),orderBy("createdAt","asc"),limit(100));
    return onSnapshot(q,snap=>{setMsgs(snap.docs.map(d=>({id:d.id,...d.data()})));setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),50);});
  },[room]);

  async function send(e) {
    e.preventDefault(); if(!text.trim()||!user) return;
    await addDoc(collection(db,"chat_"+room),{text:text.trim(),uid:user.uid,userName:profile?.displayName||user.displayName||"User",userHandle:profile?.username||user.email?.split("@")[0],userPhoto:user.photoURL||null,createdAt:serverTimestamp()});
    setText("");
  }

  if(!user) return <div style={{padding:40,textAlign:"center",color:"#9a9088",fontSize:13}}>Sign in to join the chat.</div>;

  return <div style={{height:"100%",display:"flex",overflow:"hidden"}}>
    {/* Rooms sidebar */}
    <div style={{width:180,minWidth:180,background:"#fff",borderRight:"1px solid #ede9e3",padding:"20px 0",display:"flex",flexDirection:"column"}}>
      <div style={{fontSize:9,fontWeight:700,color:"#b0a898",letterSpacing:1.5,textTransform:"uppercase",padding:"0 16px 10px"}}># Rooms</div>
      {ROOMS.map(r=><button key={r} onClick={()=>setRoom(r)} style={{background:room===r?"#fdf8f2":"none",border:"none",borderLeft:`3px solid ${room===r?"#c8860a":"transparent"}`,cursor:"pointer",padding:"9px 16px",fontSize:12,color:room===r?"#c8860a":"#5a5048",fontWeight:room===r?600:400,textAlign:"left",fontFamily:"inherit"}}># {r}</button>)}
    </div>
    {/* Chat area */}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:"#fff",borderBottom:"1px solid #ede9e3",padding:"12px 20px"}}>
        <span style={{fontSize:13,fontWeight:600,color:"#1a1410"}}># {room}</span>
        <span style={{fontSize:11,color:"#9a9088",marginLeft:8}}>Community chat room</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
        {msgs.length===0&&<div style={{color:"#9a9088",fontSize:13,fontStyle:"italic",textAlign:"center",padding:"40px 0"}}>No messages yet. Start the conversation!</div>}
        {msgs.map(m=>(
          <div key={m.id} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <Avt name={m.userName||"U"} photo={m.userPhoto} size={30} onClick={()=>onUser&&m.uid&&onUser(m.uid)}/>
            <div>
              <div style={{display:"flex",gap:8,alignItems:"baseline"}}>
                <span onClick={()=>onUser&&m.uid&&onUser(m.uid)} style={{fontSize:12,fontWeight:600,color:m.uid===user.uid?"#c8860a":"#1a1410",cursor:onUser?"pointer":"default"}}>@{m.userHandle}</span>
                <span style={{fontSize:10,color:"#b0a898"}}>{timeAgo(m.createdAt)}</span>
              </div>
              <div style={{fontSize:13,color:"#3a3028",lineHeight:1.5,marginTop:2,background:m.uid===user.uid?"#fdf8f2":"#fff",border:"1px solid #ede9e3",borderRadius:8,padding:"6px 10px",display:"inline-block",maxWidth:400}}>{m.text}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      <form onSubmit={send} style={{padding:"12px 20px",borderTop:"1px solid #ede9e3",display:"flex",gap:10}}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder={`Message #${room}...`} style={{flex:1,padding:"9px 14px",background:"#faf8f5",border:"1px solid #e5e0d8",borderRadius:8,fontSize:13,color:"#1a1410",outline:"none",fontFamily:"inherit"}}/>
        <Btn primary disabled={!text.trim()}>Send</Btn>
      </form>
    </div>
  </div>;
}

// ── BLOGS PAGE ────────────────────────────────────────────────────────────────
function BlogsPage({ onUser }) {
  const {user,profile} = useAuth();
  const [blogs,setBlogs] = useState([]); const [loading,setLoading] = useState(true);
  const [writing,setWriting] = useState(false);
  const [title,setTitle] = useState(""); const [body,setBody] = useState(""); const [busy,setBusy] = useState(false);

  useEffect(()=>{
    const q=query(collection(db,"blogs"),orderBy("createdAt","desc"),limit(30));
    return onSnapshot(q,snap=>{setBlogs(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
  },[]);

  async function publish() {
    if(!title.trim()||!body.trim()||!user) return; setBusy(true);
    await addDoc(collection(db,"blogs"),{title:title.trim(),body:body.trim(),uid:user.uid,userName:profile?.displayName||user.displayName||"User",userHandle:profile?.username||user.email?.split("@")[0],userPhoto:user.photoURL||null,likes:[],createdAt:serverTimestamp()});
    setTitle("");setBody("");setWriting(false);setBusy(false);
  }

  async function toggleLike(blog) {
    if(!user) return;
    const ref=doc(db,"blogs",blog.id);
    if((blog.likes||[]).includes(user.uid)) await updateDoc(ref,{likes:arrayRemove(user.uid)});
    else await updateDoc(ref,{likes:arrayUnion(user.uid)});
  }

  return <div style={{height:"100%",overflowY:"auto",padding:"24px 28px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <SHead title="Community Blogs" sub="Essays, opinions & deep dives"/>
      {user&&<Btn primary onClick={()=>setWriting(true)}>+ Write Blog</Btn>}
    </div>

    {writing&&<Modal title="Write a Blog Post" onClose={()=>setWriting(false)}>
      <Inp label="Title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Your blog title..."/>
      <Inp label="Content" value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your thoughts..." multiline/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn onClick={()=>setWriting(false)}>Cancel</Btn>
        <Btn primary onClick={publish} disabled={!title.trim()||!body.trim()||busy}>{busy?"Publishing...":"Publish"}</Btn>
      </div>
    </Modal>}

    {loading?<Spin/>:blogs.length===0?<div style={{color:"#9a9088",fontSize:13,fontStyle:"italic",textAlign:"center",padding:"40px 0"}}>No blogs yet. Be the first to write!</div>:blogs.map(b=>(
      <div key={b.id} style={{background:"#fff",border:"1px solid #ede9e3",borderRadius:10,padding:20,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <Avt name={b.userName||"U"} photo={b.userPhoto} onClick={()=>onUser&&b.uid&&onUser(b.uid)}/>
          <div style={{flex:1}}>
            <div onClick={()=>onUser&&b.uid&&onUser(b.uid)} style={{fontSize:13,fontWeight:600,color:"#1a1410",cursor:onUser?"pointer":"default"}}>@{b.userHandle}</div>
            <div style={{fontSize:11,color:"#b0a898"}}>{timeAgo(b.createdAt)}</div>
          </div>
        </div>
        <h3 style={{fontSize:17,fontWeight:700,color:"#1a1410",fontFamily:"Georgia,serif",marginBottom:10}}>{b.title}</h3>
        <p style={{fontSize:13,color:"#4a4038",lineHeight:1.7,marginBottom:14,display:"-webkit-box",WebkitLineClamp:4,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{b.body}</p>
        <div style={{display:"flex",gap:16,alignItems:"center"}}>
          <button onClick={()=>toggleLike(b)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:(b.likes||[]).includes(user?.uid)?"#e05a2b":"#9a9088",fontWeight:(b.likes||[]).includes(user?.uid)?600:400,fontFamily:"inherit",padding:0}}>
            {(b.likes||[]).includes(user?.uid)?"♥":"♡"} {(b.likes||[]).length}
          </button>
          {b.uid===user?.uid&&<button onClick={async()=>{if(window.confirm("Delete this blog?"))await deleteDoc(doc(db,"blogs",b.id));}} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#c0392b",fontFamily:"inherit",padding:0}}>Delete</button>}
        </div>
      </div>
    ))}
  </div>;
}

// ── PROFILE PAGE ──────────────────────────────────────────────────────────────
function ProfilePage({ onMovie, onChat }) {
  const {user,profile,refresh} = useAuth();
  const [tab,setTab] = useState("posts");
  const [posts,setPosts] = useState([]); const [reviews,setReviews] = useState([]);
  const [wlMovies,setWlMovies] = useState([]); const [favMovies,setFavMovies] = useState([]);
  const [editing,setEditing] = useState(false);
  const [eName,setEName] = useState(""); const [eBio,setEBio] = useState("");
  const TABS = ["posts","reviews","watchlist","favourites","seen"];

  useEffect(()=>{
    if(!user) return;
    const q1=query(collection(db,"posts"),where("uid","==",user.uid),orderBy("createdAt","desc"));
    const q2=query(collection(db,"reviews"),where("uid","==",user.uid),orderBy("createdAt","desc"));
    const u1=onSnapshot(q1,s=>setPosts(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(q2,s=>setReviews(s.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();};
  },[user]);

  useEffect(()=>{
    if(!profile?.watchlist?.length){setWlMovies([]);return;}
    Promise.all(profile.watchlist.slice(0,12).map(id=>api(`/movie/${id}?language=en-US`).then(tmdbMovie))).then(setWlMovies);
  },[profile?.watchlist]);

  useEffect(()=>{
    if(!profile?.favourites?.length){setFavMovies([]);return;}
    Promise.all(profile.favourites.slice(0,12).map(id=>api(`/movie/${id}?language=en-US`).then(tmdbMovie))).then(setFavMovies);
  },[profile?.favourites]);

  async function save() {
    if(!user) return;
    await updateDoc(doc(db,"users",user.uid),{displayName:eName,bio:eBio});
    await updateProfile(user,{displayName:eName});
    await refresh(); setEditing(false);
  }

  if(!user) return <div style={{padding:40,textAlign:"center",color:"#9a9088"}}>Sign in to view your profile.</div>;

  return <div style={{height:"100%",overflowY:"auto"}}>
    <div style={{background:"linear-gradient(160deg,#fdf5e8,#f8f4ee)",padding:"28px 28px 0",borderBottom:"1px solid #ede9e3"}}>
      <div style={{display:"flex",gap:20,alignItems:"flex-end"}}>
        <Avt name={profile?.displayName||user.displayName||"U"} photo={user.photoURL} size={76}/>
        <div style={{flex:1,paddingBottom:16}}>
          {editing?<>
            <Inp label="Display Name" value={eName} onChange={e=>setEName(e.target.value)}/>
            <Inp label="Bio" value={eBio} onChange={e=>setEBio(e.target.value)} multiline/>
            <div style={{display:"flex",gap:8}}><Btn primary onClick={save}>Save</Btn><Btn onClick={()=>setEditing(false)}>Cancel</Btn></div>
          </>:<>
            <h2 style={{fontSize:22,fontWeight:700,color:"#1a1410",fontFamily:"Georgia,serif",marginBottom:2}}>{profile?.displayName||user.displayName||"User"}</h2>
            <div style={{fontSize:12,color:"#9a9088",marginBottom:8}}>@{profile?.username||user.email?.split("@")[0]} · {user.email}</div>
            <div style={{fontSize:13,color:"#5a5048",lineHeight:1.5,maxWidth:400}}>{profile?.bio||"Film enthusiast."}</div>
            <div style={{display:"flex",gap:24,marginTop:14}}>
              {[[posts.length,"Posts"],[reviews.length,"Reviews"],[(profile?.watchlist||[]).length,"Watchlist"],[(profile?.favourites||[]).length,"Favourites"],[(profile?.seenList||[]).length,"Seen"]].map(([n,l])=>(
                <div key={l}><div style={{fontSize:18,fontWeight:700,color:"#1a1410",fontFamily:"Georgia,serif"}}>{n}</div><div style={{fontSize:10,color:"#9a9088"}}>{l}</div></div>
              ))}
            </div>
          </>}
        </div>
        {!editing&&<div style={{paddingBottom:16,display:"flex",gap:8}}>
          <Btn onClick={()=>{setEditing(true);setEName(profile?.displayName||"");setEBio(profile?.bio||"");}}>Edit Profile</Btn>
          <Btn danger onClick={()=>signOut(auth)}>Sign Out</Btn>
        </div>}
      </div>
      <div style={{display:"flex",marginTop:16}}>
        {TABS.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t?"#c8860a":"transparent"}`,cursor:"pointer",padding:"9px 14px",fontSize:12,fontWeight:tab===t?600:400,color:tab===t?"#c8860a":"#7a7068",marginBottom:-1,textTransform:"capitalize",fontFamily:"inherit"}}>{t}</button>)}
      </div>
    </div>

    <div style={{padding:"24px 28px"}}>
      {tab==="posts"&&<><SHead title="Your Posts" sub={`${posts.length} posts`}/>{posts.length===0?<Empty text="No posts yet — share your thoughts!"/>:posts.map(p=><PostCard key={p.id} post={p} uid={user.uid}/>)}</>}

      {tab==="reviews"&&<><SHead title="Your Reviews" sub={`${reviews.length} reviews`}/>{reviews.length===0?<Empty text="No reviews yet — review a film you've watched!"/>:reviews.map(r=>(
        <div key={r.id} style={{background:"#fff",border:"1px solid #ede9e3",borderRadius:8,padding:16,marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600,color:"#c8860a",marginBottom:4}}>{r.movieTitle}</div>
          {r.rating&&<div style={{marginBottom:8}}><Star rating={r.rating}/></div>}
          <p style={{fontSize:13,fontFamily:"Georgia,serif",fontStyle:"italic",color:"#3a3028",lineHeight:1.6}}>"{r.text}"</p>
          <div style={{fontSize:11,color:"#b0a898",marginTop:8}}>{timeAgo(r.createdAt)}</div>
        </div>
      ))}</>}

      {tab==="watchlist"&&<><SHead title="Watchlist" sub={`${(profile?.watchlist||[]).length} films`}/>{wlMovies.length===0?<Empty text="Your watchlist is empty — add films from their detail page!"/>:<PosterGrid movies={wlMovies} onMovie={onMovie}/>}</>}

      {tab==="favourites"&&<><SHead title="Favourites" sub={`${(profile?.favourites||[]).length} films`}/>{favMovies.length===0?<Empty text="No favourites yet — heart a film from its detail page!"/>:<PosterGrid movies={favMovies} onMovie={onMovie}/>}</>}

      {tab==="seen"&&<><SHead title="Seen List" sub={`${(profile?.seenList||[]).length} films`}/>{(profile?.seenList||[]).length===0?<Empty text="Mark films as seen from their detail page!"/>:<div style={{fontSize:13,color:"#5a5048"}}>{(profile?.seenList||[]).length} films marked as seen.</div>}</>}
    </div>
  </div>;
}

function PosterGrid({ movies, onMovie }) {
  return <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
    {movies.map(m=><div key={m.id} onClick={()=>onMovie(m)} style={{aspectRatio:"2/3",borderRadius:8,overflow:"hidden",cursor:"pointer",border:"1px solid #e5e0d8"}}>
      {m.posterPath?<img src={`${IMG}w185${m.posterPath}`} alt={m.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",background:PBG[m.id%PBG.length],display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#6a5a48",fontWeight:600,textAlign:"center",padding:4}}>{m.title}</div>}
    </div>)}
  </div>;
}

function Empty({ text }) {
  return <div style={{color:"#9a9088",fontSize:13,fontStyle:"italic",textAlign:"center",padding:"32px 0"}}>{text}</div>;
}

// ── USER PROFILE PAGE (view any user) ────────────────────────────────────────
function UserProfilePage({ uid: targetUid, onBack, onMovie, onUser }) {
  const { user, profile: myProfile, refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("posts");
  const isMe = user?.uid === targetUid;

  // follow/unfollow state
  const [following, setFollowing] = useState(false);
  // profile like state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!targetUid) return;
    setLoading(true);
    // load target user profile (live)
    const unsub = onSnapshot(doc(db, "users", targetUid), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setProfile(d);
        setFollowing((d.followers || []).includes(user?.uid));
        setLiked((d.profileLikes || []).includes(user?.uid));
        setLikeCount((d.profileLikes || []).length);
      }
      setLoading(false);
    });
    // posts
    const q1 = query(collection(db,"posts"), where("uid","==",targetUid), orderBy("createdAt","desc"));
    const u1 = onSnapshot(q1, s => setPosts(s.docs.map(d=>({id:d.id,...d.data()}))));
    // reviews
    const q2 = query(collection(db,"reviews"), where("uid","==",targetUid), orderBy("createdAt","desc"));
    const u2 = onSnapshot(q2, s => setReviews(s.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { unsub(); u1(); u2(); };
  }, [targetUid, user?.uid]);

  async function toggleFollow() {
    if (!user || isMe) return;
    const targetRef = doc(db, "users", targetUid);
    const myRef = doc(db, "users", user.uid);
    if (following) {
      await updateDoc(targetRef, { followers: arrayRemove(user.uid) });
      await updateDoc(myRef, { following: arrayRemove(targetUid) });
      setFollowing(false);
    } else {
      await updateDoc(targetRef, { followers: arrayUnion(user.uid) });
      await updateDoc(myRef, { following: arrayUnion(targetUid) });
      setFollowing(true);
    }
    refresh();
  }

  async function toggleProfileLike() {
    if (!user || isMe) return;
    const ref = doc(db, "users", targetUid);
    if (liked) {
      await updateDoc(ref, { profileLikes: arrayRemove(user.uid) });
      setLikeCount(c => c - 1);
    } else {
      await updateDoc(ref, { profileLikes: arrayUnion(user.uid) });
      setLikeCount(c => c + 1);
    }
    setLiked(l => !l);
  }

  if (loading) return <Spin />;
  if (!profile) return <div style={{padding:40,textAlign:"center",color:"#9a9088"}}>User not found.</div>;

  const TABS = ["posts", "reviews"];

  return <div style={{height:"100%",overflowY:"auto"}}>
    {/* Hero */}
    <div style={{background:"linear-gradient(160deg,#fdf5e8,#f8f4ee)",padding:"28px 28px 0",borderBottom:"1px solid #ede9e3"}}>
      <button onClick={onBack} style={{background:"#fff",border:"1px solid #d5cfc8",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12,color:"#6a6058",fontFamily:"inherit",marginBottom:18}}>← Back</button>
      <div style={{display:"flex",gap:20,alignItems:"flex-end"}}>
        <Avt name={profile.displayName||"U"} photo={profile.photoURL} size={76}/>
        <div style={{flex:1,paddingBottom:16}}>
          <h2 style={{fontSize:22,fontWeight:700,color:"#1a1410",fontFamily:"Georgia,serif",marginBottom:2}}>{profile.displayName||"User"}</h2>
          <div style={{fontSize:12,color:"#9a9088",marginBottom:8}}>@{profile.username}</div>
          <div style={{fontSize:13,color:"#5a5048",lineHeight:1.5,maxWidth:400,marginBottom:12}}>{profile.bio||"Film enthusiast."}</div>
          {/* Stats */}
          <div style={{display:"flex",gap:24}}>
            {[[posts.length,"Posts"],[reviews.length,"Reviews"],[(profile.followers||[]).length,"Followers"],[(profile.following||[]).length,"Following"],[likeCount,"Likes"]].map(([n,l])=>(
              <div key={l}><div style={{fontSize:18,fontWeight:700,color:"#1a1410",fontFamily:"Georgia,serif"}}>{n}</div><div style={{fontSize:10,color:"#9a9088"}}>{l}</div></div>
            ))}
          </div>
        </div>
        {/* Actions */}
        {!isMe && user && (
          <div style={{paddingBottom:16,display:"flex",gap:8,flexDirection:"column"}}>
            <button onClick={toggleFollow} style={{background:following?"#edf7ed":"#c8860a",color:following?"#2a7a2a":"#fff",border:following?"1px solid #b0ddb0":"none",borderRadius:6,padding:"8px 20px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",minWidth:100}}>
              {following?"✓ Following":"+ Follow"}
            </button>
            <button onClick={toggleProfileLike} style={{background:liked?"#fff5e0":"#fff",color:liked?"#c8860a":"#4a4038",border:`1px solid ${liked?"#e8d080":"#e5e0d8"}`,borderRadius:6,padding:"7px 20px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
              {liked?"♥ Liked":"♡ Like Profile"}
            </button>
          </div>
        )}
        {isMe && (
          <div style={{paddingBottom:16}}>
            <Chip label="Your Profile" v="amber"/>
          </div>
        )}
      </div>
      <div style={{display:"flex",marginTop:16}}>
        {TABS.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t?"#c8860a":"transparent"}`,cursor:"pointer",padding:"9px 14px",fontSize:12,fontWeight:tab===t?600:400,color:tab===t?"#c8860a":"#7a7068",marginBottom:-1,textTransform:"capitalize",fontFamily:"inherit"}}>{t}</button>)}
      </div>
    </div>

    <div style={{padding:"24px 28px"}}>
      {tab==="posts"&&(
        posts.length===0
          ? <Empty text="No posts yet."/>
          : posts.map(p=><PostCard key={p.id} post={p} uid={user?.uid} onUser={onUser}/>)
      )}
      {tab==="reviews"&&(
        reviews.length===0
          ? <Empty text="No reviews yet."/>
          : reviews.map(r=>(
            <div key={r.id} style={{background:"#fff",border:"1px solid #ede9e3",borderRadius:8,padding:16,marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:600,color:"#c8860a",marginBottom:4}}>{r.movieTitle}</div>
              {r.rating&&<div style={{marginBottom:8}}><Star rating={r.rating}/></div>}
              <p style={{fontSize:13,fontFamily:"Georgia,serif",fontStyle:"italic",color:"#3a3028",lineHeight:1.6}}>"{r.text}"</p>
              <div style={{fontSize:11,color:"#b0a898",marginTop:8}}>{timeAgo(r.createdAt)}</div>
            </div>
          ))
      )}
    </div>
  </div>;
}

// ── APP SHELL ─────────────────────────────────────────────────────────────────
function Shell() {
  const {user,profile} = useAuth();
  const [page,setPage] = useState("home");
  const [movie,setMovie] = useState(null);
  const [viewingUid, setViewingUid] = useState(null);

  if(user===undefined) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f5f2ec"}}><Spin/></div>;
  if(!user) return <AuthPage/>;

  const go = p => setPage(p);
  const openMovie = m => { setMovie(m); setPage("movie"); };
  const openUser = uid => {
    if (!uid) return;
    if (uid === user.uid) { setPage("profile"); return; }
    setViewingUid(uid); setPage("userprofile");
  };

  const SIDEBAR = [
    {section:"Browse",items:[{id:"home",icon:"◈",label:"Feed"},{id:"discover",icon:"⌕",label:"Discover"}]},
    {section:"Community",items:[{id:"chat",icon:"◌",label:"Chat"},{id:"blogs",icon:"✏",label:"Blogs"}]},
    {section:"Your Space",items:[{id:"profile",icon:"◎",label:"Profile"}]},
  ];

  return <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#f5f2ec",height:"100vh",display:"flex",flexDirection:"column"}}>
    <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#f5f2ec}::-webkit-scrollbar-thumb{background:#d5cfc8;border-radius:2px}input:focus,textarea:focus,select:focus{border-color:#c8860a!important;outline:none!important}`}</style>

    {/* Nav */}
    <nav style={{height:54,background:"#fff",borderBottom:"1px solid #ede9e3",display:"flex",alignItems:"center",padding:"0 20px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)",flexShrink:0}}>
      <div onClick={()=>go("home")} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",flex:1}}>
        <div style={{width:30,height:20,background:"#1a1410",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
          <div style={{width:9,height:9,borderRadius:"50%",background:"#c8860a"}}/>
          <div style={{position:"absolute",left:-4,top:"50%",transform:"translateY(-50%)",width:4,height:4,borderRadius:"50%",background:"#ccc"}}/>
          <div style={{position:"absolute",right:-4,top:"50%",transform:"translateY(-50%)",width:4,height:4,borderRadius:"50%",background:"#ccc"}}/>
        </div>
        <span style={{fontSize:15,fontWeight:700,color:"#1a1410",letterSpacing:2.5,fontFamily:"Georgia,serif"}}>RETROCULT</span>
      </div>
      <div style={{display:"flex",gap:2}}>
        {[{id:"home",l:"Feed"},{id:"discover",l:"Discover"},{id:"chat",l:"Chat"},{id:"blogs",l:"Blogs"},{id:"profile",l:"Profile"}].map(n=>(
          <button key={n.id} onClick={()=>go(n.id)} style={{background:page===n.id?"#fdf0e0":"none",border:"none",cursor:"pointer",padding:"6px 12px",borderRadius:6,fontSize:12,fontWeight:page===n.id?600:400,color:page===n.id?"#c8860a":"#6a6058",fontFamily:"inherit"}}>{n.l}</button>
        ))}
      </div>
      <div style={{flex:1,display:"flex",justifyContent:"flex-end",gap:10,alignItems:"center"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1}}>
          <span style={{fontSize:12,fontWeight:600,color:"#1a1410"}}>@{profile?.username||user.email?.split("@")[0]}</span>
          <span style={{fontSize:10,color:"#9a9088"}}>{(profile?.followers||[]).length} followers · {(profile?.following||[]).length} following</span>
        </div>
        <Avt name={profile?.displayName||user.displayName||"U"} photo={user.photoURL} size={32} onClick={()=>go("profile")}/>
      </div>
    </nav>

    <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {/* Sidebar */}
      <div style={{width:186,minWidth:186,background:"#fff",borderRight:"1px solid #ede9e3",padding:"16px 0",overflowY:"auto",flexShrink:0}}>
        {SIDEBAR.map((g,gi)=><div key={gi} style={{marginBottom:6}}>
          <div style={{fontSize:9,fontWeight:700,color:"#b0a898",letterSpacing:1.5,textTransform:"uppercase",padding:"10px 18px 5px"}}>{g.section}</div>
          {g.items.map((item,ii)=><button key={ii} onClick={()=>go(item.id)} style={{width:"100%",background:page===item.id?"#fdf8f2":"none",border:"none",borderLeft:`3px solid ${page===item.id?"#c8860a":"transparent"}`,cursor:"pointer",padding:"8px 18px",display:"flex",alignItems:"center",gap:10,fontSize:13,color:page===item.id?"#c8860a":"#5a5048",fontWeight:page===item.id?600:400,textAlign:"left",fontFamily:"inherit"}}>
            <span style={{fontSize:12,width:16}}>{item.icon}</span>{item.label}
          </button>)}
        </div>)}
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"hidden"}}>
        {page==="home"&&<HomePage onMovie={openMovie} onUser={openUser}/>}
        {page==="discover"&&<DiscoverPage onMovie={openMovie}/>}
        {page==="movie"&&movie&&<MovieDetail movie={movie} onBack={()=>go("home")} onMovie={openMovie}/>}
        {page==="chat"&&<ChatPage onUser={openUser}/>}
        {page==="blogs"&&<BlogsPage onUser={openUser}/>}
        {page==="profile"&&<ProfilePage onMovie={openMovie} onChat={()=>go("chat")}/>}
        {page==="userprofile"&&viewingUid&&<UserProfilePage uid={viewingUid} onBack={()=>go("home")} onMovie={openMovie} onUser={openUser}/>}
      </div>
    </div>
  </div>;
}

export default function RetroCult() {
  return <AuthProvider><Shell/></AuthProvider>;
}