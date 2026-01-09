import 'bootstrap/dist/css/bootstrap.min.css'
import '../styles/globals.css'
import { Analytics } from "@vercel/analytics/next"

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
