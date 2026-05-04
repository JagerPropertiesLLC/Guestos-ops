// app/long-term/properties/[id]/page.js
import PropertyDetail from '@/components/property/PropertyDetail';

export default function LtrPropertyPage({ params }) {
  return <PropertyDetail propertyId={params.id} module="long-term" />;
}
