import { Layout } from './components/Layout'
import { useRoute } from './router'

export default function App() {
  const route = useRoute()
  return (
    <Layout route={route}>
      <h1>Flow Coach</h1>
      <div className="card muted">Page en construction.</div>
    </Layout>
  )
}
