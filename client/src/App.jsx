import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import Vendors from './pages/Vendors'
import StatusBoard from './pages/StatusBoard'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/status" element={<StatusBoard />} />
      </Routes>
    </Layout>
  )
}
