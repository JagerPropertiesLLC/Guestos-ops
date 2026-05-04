// app/short-term/properties/[id]/page.js
import PropertyDetail from '@/components/property/PropertyDetail';

export default function StrPropertyPage({ params }) {
  return <PropertyDetail propertyId={params.id} module="short-term" />;
}
