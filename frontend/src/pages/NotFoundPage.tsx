import { Link, isRouteErrorResponse, useRouteError } from 'react-router'

export default function NotFoundPage() {
  return <ErrorView title="Page not found" message="The page you are looking for does not exist or was moved." />
}

export function RouteErrorPage() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return notFound ? (
    <NotFoundPage />
  ) : (
    <ErrorView title="Something went wrong" message="An unexpected error occurred. Please try again." />
  )
}

function ErrorView({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-brand-600">NegoMarket</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-ink-muted">{message}</p>
      <Link to="/" className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Back to home
      </Link>
    </div>
  )
}
