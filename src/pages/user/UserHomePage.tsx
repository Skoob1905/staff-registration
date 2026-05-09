import { useEffect, useState } from "react";
import { Button, Card } from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { getPendingContracts, uploadSignedContract } from "../../services/contractService";
import { getPayslipsForUser } from "../../services/payslipService";
import type { Payslip, UnsignedContract } from "../../types/domain";

export const UserHomePage = () => {
  const { appUser } = useAuth();
  const [contracts, setContracts] = useState<UnsignedContract[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!appUser) return;
      const [pending, slips] = await Promise.all([
        getPendingContracts(appUser.uid, appUser.agencyId),
        getPayslipsForUser(appUser.uid, appUser.agencyId),
      ]);
      setContracts(pending);
      setPayslips(slips);
    };
    void run();
  }, [appUser]);

  const onUploadSigned = async (contractId: string, file: File | null) => {
    if (!appUser || !file) return;
    try {
      await uploadSignedContract(file, appUser.uid, appUser.agencyId, contractId);
      setStatus("Signed contract uploaded.");
      const pending = await getPendingContracts(appUser.uid, appUser.agencyId);
      setContracts(pending);
    } catch {
      setStatus("Could not upload signed contract.");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-bold">To Do</h2>
        <p className="mt-2 text-sm text-zinc-600">{contracts.length ? "Contract to Sign" : "No contracts pending signature."}</p>
        <p className="mt-1 text-sm text-zinc-600">{payslips.length ? "Payslip Received" : "No payslips yet."}</p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Contracts</h2>
        <div className="mt-3 space-y-3">
          {contracts.map((contract) => (
            <ContractRow key={contract.id} contract={contract} onUploadSigned={onUploadSigned} />
          ))}
          {!contracts.length ? <p className="text-sm text-zinc-500">No pending contracts.</p> : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Payslips</h2>
        <div className="mt-3 space-y-2">
          {payslips.map((payslip) => (
            <a key={payslip.id} href={payslip.fileUrl} target="_blank" rel="noreferrer" className="block text-sm text-zinc-800 underline">
              {payslip.fileName} ({payslip.periodLabel})
            </a>
          ))}
          {!payslips.length ? <p className="text-sm text-zinc-500">No payslips available.</p> : null}
        </div>
      </Card>

      {status ? <p className="text-sm text-zinc-600">{status}</p> : null}
    </div>
  );
};

const ContractRow = ({
  contract,
  onUploadSigned,
}: {
  contract: UnsignedContract;
  onUploadSigned: (contractId: string, file: File | null) => Promise<void>;
}) => {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <a href={contract.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-zinc-800 underline">
        {contract.fileName}
      </a>
      <div className="mt-2 flex items-center gap-2">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <Button type="button" onClick={() => void onUploadSigned(contract.id, file)}>
          Upload Signed
        </Button>
      </div>
    </div>
  );
};
