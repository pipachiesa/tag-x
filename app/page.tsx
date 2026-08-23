import Workspace from "./workspace";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";

function Mark(){return <div className="tx-mark"><b>T</b><span>X</span></div>}

export default async function Home(){
  const user=await getChatGPTUser();
  if(!user){
    return <main className="login-screen"><section className="login-card"><Mark/><span>TAG X</span><h1>Football video intelligence</h1><p>Create your account or sign in to manage matches, teams and analysis.</p><a className="google-login" href={chatGPTSignInPath("/")}><i>G</i>Continue with Google</a><small>Gmail accounts only</small></section></main>;
  }
  const gmail=/@(gmail|googlemail)\.com$/i.test(user.email);
  if(!gmail){
    return <main className="login-screen"><section className="login-card"><Mark/><span>TAG X</span><h1>Use a Gmail account</h1><p>Tag X currently accepts Google accounts ending in @gmail.com.</p><a className="google-login" href={chatGPTSignOutPath("/")}><i>G</i>Choose another account</a><small>{user.email}</small></section></main>;
  }
  return <Workspace user={{displayName:user.displayName,email:user.email}}/>;
}
