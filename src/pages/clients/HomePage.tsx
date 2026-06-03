import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthProvider";
import { getPayslipsForUser } from "../../services/payslipService";
import type { Payslip } from "../../types/domain";
import { StaffListSection } from "../../components/StaffListSection";

export const UserHomePage = () => {
  useEffect(() => {
    document.title = "Home";
  }, []);
  const { appUser } = useAuth();
  const [, setPayslips] = useState<Payslip[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!appUser) return;
      const [slips] = await Promise.all([
        getPayslipsForUser(appUser.uid, appUser.agencyId),
      ]);
      setPayslips(slips);
    };
    void run();
  }, [appUser]);

  return (
    <div className="mx-auto space-y-4">
      {/* <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold">To Do</h2>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${registrationStatus === "awaiting" ? "border-[color:rgba(245,158,11,0.28)] bg-[color:rgba(251,191,36,0.18)] text-amber-700" : "border-[color:rgba(16,185,129,0.28)] bg-[color:rgba(52,211,153,0.18)] text-emerald-700"}`}
          >
            {registrationStatus === "awaiting"
              ? "Not Registered"
              : "Registered"}
          </span>
          {appUser?.contractSigned === false && appUser?.contractSent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:rgba(251,191,36,0.18)] border border-[color:rgba(245,158,11,0.28)] px-3 py-1 text-xs font-semibold text-amber-700">
              <FileText className="h-3.5 w-3.5" />
              <span>Not Signed</span>
            </span>
          ) : appUser?.contractSigned === true ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:rgba(52,211,153,0.18)] border border-[color:rgba(16,185,129,0.28)] px-3 py-1 text-xs font-semibold text-emerald-700">
              <FileText className="h-3.5 w-3.5" />
              <span>Signed</span>
            </span>
          ) : null}
          {registrationStatus === "registered" && !appUser?.contractSent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:rgba(248,113,113,0.16)] border border-[color:rgba(239,68,68,0.26)] px-3 py-1 text-xs font-semibold text-red-600">
              <FileText className="h-3.5 w-3.5" />
              <span>Not Sent</span>
            </span>
          ) : null}
        </div>
        {appUser?.contractSigned === false && appUser?.contractSentBy ? (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Sent By: {appUser.contractSentBy} at{" "}
            {formatInvitedAt(appUser.contractSent)}
          </p>
        ) : null}

        {registrationStatus === "awaiting" ? (
          <Button
            type="button"
            className="mt-3"
            onClick={() => setShowRegistrationModal(true)}
          >
            Register Now
          </Button>
        ) : appUser?.contractSigned === false && appUser?.contractSentBy ? (
          <Button
            type="button"
            className="mt-3"
            disabled={openingSignModal}
            onClick={async () => {
              if (!appUser) return;
              setOpeningSignModal(true);
              try {
                const freshContracts = await getPendingContracts(
                  appUser.uid,
                  appUser.agencyId,
                );
                setContracts(freshContracts);
                const latest = await getLatestUnsignedContract(
                  appUser.uid,
                  appUser.agencyId,
                );
                if (!latest) {
                  toast({
                    title: "No contract found",
                    description: "Please refresh and try again.",
                    variant: "error",
                  });
                  return;
                }
                onOpenSignModal(latest);
              } finally {
                setOpeningSignModal(false);
              }
            }}
          >
            {openingSignModal ? "Opening..." : "Sign Contract"}
          </Button>
        ) : registrationStatus === "registered" &&
          !latestUndownloadedPayslip ? (
          <p className="mt-3 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Relax! There is nothing to do
          </p>
        ) : null}
        {registrationStatus === "registered" && latestUndownloadedPayslip ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[color:rgba(0,95,87,0.08)] px-3 py-2">
            <p className="text-xs sm:text-sm text-[var(--foreground)]">
              Download latest payslip
            </p>
            <Button
              type="button"
              className="bg-[var(--primary)] text-white"
              onClick={() => void onDownloadPayslip(latestUndownloadedPayslip)}
            >
              Download
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <div id="contracts-section" />
        <h2 className="text-base sm:text-lg font-bold">Contracts</h2>
        <div className="mt-1.5 rounded-xl border border-[var(--border)] bg-[color:rgba(0,95,87,0.08)] p-3 sm:mt-3">
          <div className="space-y-1 text-xs sm:text-sm text-[var(--foreground)]">
            {appUser?.contractSent ? (
              <p>
                <b>Sent By:</b> {appUser.contractSentBy ?? "Unknown"} at{" "}
                {formatInvitedAt(appUser.contractSent)}
              </p>
            ) : null}
            {contracts[0] || signedContracts[0] ? (
              <div className="flex items-center gap-2">
                <b>Contract:</b>{" "}
                {contracts[0]?.fileName ?? signedContracts[0]?.fileName}
                {contracts[0]?.fileUrl || signedContracts[0]?.fileUrl ? (
                  <ActionButton
                    variant="download"
                    href={contracts[0]?.fileUrl ?? signedContracts[0]?.fileUrl}
                    ariaLabel="Download contract"
                  />
                ) : null}
              </div>
            ) : null}
            {appUser?.contractSignedAt ? (
              <p>
                <b>Signed At:</b> {formatInvitedAt(appUser.contractSignedAt)}
              </p>
            ) : appUser?.contractSigned === undefined ? (
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                No contracts signed.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base sm:text-lg font-bold">Payslips</h2>
        {payslips.length ? (
          <div className="mt-1.5 overflow-hidden rounded-xl border border-[var(--border)] sm:mt-3">
            <AccordionRoot type="single" collapsible>
              {payslips.map((payslip) => (
                <AccordionItem
                  key={payslip.id}
                  value={payslip.id}
                  title={
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{payslip.fileName}</span>
                      {!payslip.hasDownloaded && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          New
                        </span>
                      )}
                      <ActionButton
                          variant="download"
                          ariaLabel="Download payslip"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void onDownloadPayslip(payslip);
                          }}
                        />
                    </div>
                  }
                >
                  <div className="space-y-1 text-xs sm:text-sm text-zinc-600">
                    <p>
                      <b>Sent By:</b> {payslip.sentBy ?? "Unknown"}
                    </p>
                    <p>
                      <b>Sent At:</b> {formatInvitedAt(payslip.timestamp)}
                    </p>
                  </div>
                </AccordionItem>
              ))}
            </AccordionRoot>
          </div>
        ) : (
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-500 sm:mt-3">No payslips available.</p>
        )}
      </Card> */}

      {/* <DialogRoot
        open={showRegistrationModal}
        onOpenChange={setShowRegistrationModal}
      >
        <DialogContent onClose={() => setShowRegistrationModal(false)}>
          <DialogTitle className="text-base sm:text-lg font-bold">
            Complete Registration
          </DialogTitle>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600">
            Please provide your details to complete onboarding.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                First name
              </label>
              <input
                value={formData.firstName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, firstName: true }))
                }
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs sm:text-sm"
              />
              {touched.firstName && "firstName" in formErrors ? (
                <p className="mt-1 text-xs text-red-600">
                  {formErrors.firstName}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                Last name
              </label>
              <input
                value={formData.lastName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                }
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, lastName: true }))
                }
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs sm:text-sm"
              />
              {touched.lastName && "lastName" in formErrors ? (
                <p className="mt-1 text-xs text-red-600">
                  {formErrors.lastName}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Birthday
            </label>
            <input
              type="date"
              value={formData.birthday}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, birthday: e.target.value }))
              }
              onBlur={() => setTouched((prev) => ({ ...prev, birthday: true }))}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs sm:text-sm"
            />
            {touched.birthday && "birthday" in formErrors ? (
              <p className="mt-1 text-xs text-red-600">{formErrors.birthday}</p>
            ) : null}
          </div>

          <div className="mt-3">
            <label className="text-xs sm:text-sm font-medium text-zinc-700">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              onBlur={() => setTouched((prev) => ({ ...prev, address: true }))}
              className="mt-1 min-h-24 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs sm:text-sm"
            />
            {touched.address && "address" in formErrors ? (
              <p className="mt-1 text-xs text-red-600">{formErrors.address}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={formData.honestyConfirmed}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    honestyConfirmed: e.target.checked,
                  }))
                }
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, honestyConfirmed: true }))
                }
                className="h-4 w-4 rounded border border-[var(--border)]"
              />
              I have answered honestly
            </label>
            {touched.honestyConfirmed && "honestyConfirmed" in formErrors ? (
              <p className="mt-1 text-xs text-red-600">
                {formErrors.honestyConfirmed}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={!isRegistrationValid || registrationLoading}
              onClick={() => void onRegisterNow()}
            >
              {registrationLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Registering...
                </span>
              ) : (
                "Register"
              )}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot> */}

      <StaffListSection view="client" />

      {/* <SignModal
        open={showSignModal}
        contract={activeContract}
        showDrawPad={showDrawPad}
        signingLoading={signingLoading}
        signaturePadRef={signaturePadRef}
        onClose={() => {
          setShowSignModal(false);
          setActiveContract(null);
          setShowDrawPad(false);
        }}
        onStartSign={() => setShowDrawPad(true)}
        onClearSignature={() => signaturePadRef.current?.clear()}
        onSubmitSignature={onApplySignature}
      /> */}
    </div>
  );
};
