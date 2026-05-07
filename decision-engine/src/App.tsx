import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import SessionPage from '@/pages/Session'
import ResultPage from '@/pages/Result'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
        <Route path="/session/:sessionId/result" element={<ResultPage />} />
      </Routes>
    </Router>
  )
}
