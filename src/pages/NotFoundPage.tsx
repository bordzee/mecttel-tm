import { Link } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { CenteredState, LinkButton, PageTitle } from '../components/ui/primitives'

export function NotFoundPage() {
  return (
    <AppLayout>
      <CenteredState>
        <PageTitle>Page not found</PageTitle>
        <p className="text-sm text-text-steel">The link may be wrong or the page was removed.</p>
        <LinkButton to="/">Back to home</LinkButton>
        <Link to="/admin/login" className="text-sm font-semibold text-accent-text hover:underline">
          Admin login
        </Link>
      </CenteredState>
    </AppLayout>
  )
}
