import { CreatorsListTable } from "@/components/creators-list-table";
import { CreateCreatorDialog } from "@/components/create-creator-dialog";
import {
  getCreatorsWithBrands,
  getBrandsForSelect,
} from "./actions";

export default async function CreatorsListPage() {
  const [creators, brands] = await Promise.all([
    getCreatorsWithBrands(),
    getBrandsForSelect(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Creators</h1>
        <CreateCreatorDialog brands={brands} />
      </div>
      <CreatorsListTable creators={creators} />
    </div>
  );
}
