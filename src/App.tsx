import { greeting } from './greeting'

export default function App() {
  return (
    <main className="hello">
      <h1>{greeting()}</h1>
    </main>
  )
}
