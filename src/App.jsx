import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function App() {
  // Form state
  const [photos, setPhotos] = useState([]);
  const [markedPhotos, setMarkedPhotos] = useState([]);
  const [isRepeated, setIsRepeated] = useState(false);
  const [approvalStage, setApprovalStage] = useState("Inspector");

  // Handle photo upload
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    setPhotos(files);
  };

  // Mark damage on photo
  const markDamage = (index) => {
    const updated = [...markedPhotos];
    updated[index] = true;
    setMarkedPhotos(updated);
  };

  // Export report stub
  const exportReport = (format) => {
    alert(`BSI Report exported as ${format}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-4">RD-93 Borescope Inspection (BSI) Report</h1>

      {/* Engine / Aircraft Info */}
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-2 gap-4">
          <Input placeholder="Engine Serial No" />
          <Input placeholder="Aircraft Serial No" />
          <Input type="date" placeholder="Inspection Date" />
          <Input placeholder="Inspection Type (Routine / Special)" />
        </CardContent>
      </Card>

      {/* Damage Observation */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-2">Damage Observation</h2>
          <div className="grid grid-cols-3 gap-3">
            <Input placeholder="Module" />
            <Input placeholder="Stage No" />
            <Input placeholder="Blade / Vane No" />
            <Input placeholder="Damage Type" />
            <Input placeholder="Length (mm)" />
            <Input placeholder="Width (mm)" />
            <Input placeholder="Depth (mm)" />
            <Input placeholder="New / Progressive / Stable" />
          </div>

          {isRepeated && (
            <Badge className="mt-3 bg-red-600">Repeated / Progressive Defect Detected</Badge>
          )}

          <Textarea className="mt-3" placeholder="Engineering Remarks & Probable Cause" />
        </CardContent>
      </Card>

      {/* Borescope Images */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-2">Borescope Images (Mark Damage)</h2>
          <Input type="file" multiple accept="image/*" onChange={handlePhotoUpload} />
          <div className="mt-3 grid grid-cols-3 gap-3">
            {photos.map((file, index) => (
              <div key={index} className="relative">
                <img src={URL.createObjectURL(file)} className="rounded-lg shadow" />
                {markedPhotos[index] && (
                  <div className="absolute inset-0 border-4 border-red-600 rounded-lg"></div>
                )}
                <Button size="sm" className="mt-1" onClick={() => markDamage(index)}>
                  Mark Damage
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Approval Workflow */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-2">Approval Workflow</h2>
          <div className="grid grid-cols-3 gap-3">
            <Badge>Inspector</Badge>
            <Badge variant={approvalStage !== "Inspector" ? "default" : "outline"}>
              Engineer
            </Badge>
            <Badge variant={approvalStage === "Approved" ? "default" : "outline"}>
              O i/c
            </Badge>
          </div>
          <Button className="mt-3" onClick={() => setApprovalStage("Engineer")}>
            Forward to Engineer
          </Button>
          <Button className="mt-3 ml-2" onClick={() => setApprovalStage("Approved")}>
            Approve (O i/c)
          </Button>
        </CardContent>
      </Card>

      {/* Export */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-2">Export BSI Report</h2>
          <div className="flex gap-3">
            <Button onClick={() => exportReport("PDF")}>Export PDF</Button>
            <Button onClick={() => exportReport("Excel")}>Export Excel</Button>
          </div>
        </CardContent>
      </Card>

      <Button className="mt-4">Submit BSI Report</Button>
    </div>
  );
}